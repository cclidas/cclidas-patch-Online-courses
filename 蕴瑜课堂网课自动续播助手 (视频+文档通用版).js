// ==UserScript==
// @name         蕴瑜课堂网课自动续播助手 (视频+文档通用版)
// @namespace    http://tampermonkey.net/
// @version      2.2
// @description  courses.gdut.edu.cn 专用：视频自动连播，PPT/PDF停留指定时间后自动跳转，支持会话超时处理
// @author       Dylan
// @match        https://courses.gdut.edu.cn/mod/fsresource/view.php?id=*
// @grant        unsafeWindow
// @downloadURL  https://github.com/cclidas/cclidas-patch-Online-courses/main/
// @updateURL   https://github.com/cclidas/cclidas-patch-Online-courses
// ==/UserScript==

(function() {
    'use strict';

    // --- 🔧 配置区域 (可根据需求修改) ---
    const config = {
        playbackRate: 1.0,      // 视频播放倍速 (建议 1.0 或 1.5)
        videoJumpDelay: 3000,   // 视频结束后等待多少毫秒跳转 (3秒)
        docStayTime: 5000,      // 文档/PPT页面停留时间 (毫秒，这里设为5秒)
        detectTime: 4000,       // 检测页面类型的最大等待时间 (4秒内没刷出视频就当做是文档)
        sessionCheckInterval: 5000, // 检查会话超时的间隔时间 (5秒)
        autoHandleSessionTimeout: true // 是否自动处理会话超时
    };

    // 重写原生的confirm函数以自动确认
    const originalConfirm = unsafeWindow.confirm;
    const originalAlert = unsafeWindow.alert;
    const originalPrompt = unsafeWindow.prompt;

    // 重写confirm函数
    unsafeWindow.confirm = function(message) {
        console.log("检测到浏览器确认对话框:", message);
        // 检查是否包含会话相关的关键字
        if (message && (message.includes('会话') || message.includes('session') || message.includes('timeout'))) {
            console.log("检测到会话相关的确认对话框，自动确认");
            return true; // 自动确认
        }
        // 对于其他确认对话框，也自动确认
        console.log("自动确认对话框");
        return true;
    };

    // 重写alert函数
    unsafeWindow.alert = function(message) {
        console.log("检测到浏览器警告对话框:", message);
        // 检查是否包含会话相关的关键字
        if (message && (message.includes('会话') || message.includes('session') || message.includes('timeout'))) {
            console.log("检测到会话相关的警告对话框，自动关闭");
        }
        // 静默处理，不显示alert
        return;
    };

    // 重写prompt函数
    unsafeWindow.prompt = function(message, defaultValue) {
        console.log("检测到浏览器输入对话框:", message);
        // 检查是否包含会话相关的关键字
        if (message && (message.includes('会话') || message.includes('session') || message.includes('timeout'))) {
            console.log("检测到会话相关的输入对话框");
        }
        // 返回默认值或空值
        return defaultValue || "";
    };

    // --- 🚀 脚本主逻辑 ---
    console.log("脚本启动：正在分析页面类型...");

    // 状态标记
    let isVideoMode = false;
    let detectionFinished = false;

    // 1. 启动检测循环 (尝试寻找 video 标签)
    let attempts = 0;
    const detector = setInterval(() => {
        const video = document.querySelector('video');
        attempts++;

        //情况A: 找到了视频 -> 进入视频模式
        if (video) {
            clearInterval(detector); // 停止检测
            isVideoMode = true;
            detectionFinished = true;
            console.log(">>> 检测结果：当前页面是【视频】");
            runVideoLogic(video);
        }
        // 情况B: 超过检测时间还没视频 -> 进入文档模式
        else if (attempts * 1000 >= config.detectTime) {
            clearInterval(detector);
            isVideoMode = false;
            detectionFinished = true;
            console.log(">>> 检测结果：当前页面是【文档/PPT/其他】");
            runDocLogic();
        }
    }, 1000); // 每秒检查一次

    // 启动会话超时检测
    if (config.autoHandleSessionTimeout) {
        startSessionTimeoutCheck();
    }


    // --- 📺 视频处理逻辑 ---
    function runVideoLogic(video) {
        // 1. 确保静音播放
        setInterval(() => {
            if (video.paused) {
                video.muted = true;
                video.play().catch(e => console.log("等待交互以播放..."));
            }
            // 保持倍速
            if (video.playbackRate !== config.playbackRate) {
                video.playbackRate = config.playbackRate;
            }
        }, 1000);

        // 2. 监听结束
        video.addEventListener('ended', function() {
            console.log("视频播放结束！");
            showCountDown(config.videoJumpDelay, "视频播放完成，即将跳转...");
            setTimeout(jumpToNextId, config.videoJumpDelay);
        });
    }

    // --- 📄 文档/PPT处理逻辑 ---
    function runDocLogic() {
        console.log(`将在 ${config.docStayTime / 1000} 秒后自动跳转下一节...`);
        // 开始倒计时跳转
        showCountDown(config.docStayTime, "文档阅读模式，正在倒计时跳转...");
        setTimeout(() => {
            jumpToNextId();
        }, config.docStayTime);
    }

    // --- ⏭️ 通用跳转函数 (ID + 1) ---
    function jumpToNextId() {
        const currentUrl = window.location.href;
        const urlParams = new URLSearchParams(window.location.search);
        const currentIdStr = urlParams.get('id');

        if (currentIdStr) {
            const currentId = parseInt(currentIdStr);
            const nextId = currentId + 1;
            const nextUrl = currentUrl.replace(`id=${currentId}`, `id=${nextId}`);
            console.log(`正在跳转: ID ${currentId} -> ${nextId}`);
            window.location.href = nextUrl;
        } else {
            console.error("URL中未找到ID参数，无法跳转");
        }
    }

    // --- 💡 简单的倒计时提示 (在网页标题显示) ---
    function showCountDown(totalTime, msg) {
        console.log(msg);
        let remaining = totalTime / 1000;
        document.title = `[${remaining}s] ${msg}`; // 修改网页标题提示用户
        const timer = setInterval(() => {
            remaining--;
            if (remaining <= 0) {
                clearInterval(timer);
                document.title = "正在跳转...";
            } else {
                document.title = `[${remaining}s] 跳转倒计时`;
            }
        }, 1000);
    }

    // --- 🔐 会话超时检测与处理 ---
    function startSessionTimeoutCheck() {
        console.log("启动会话超时检测...");

        // 定期检查会话超时对话框
        setInterval(() => {
            checkForSessionTimeoutDialog();
        }, config.sessionCheckInterval);
    }

    function checkForSessionTimeoutDialog() {
        // 检测页面内的会话超时对话框
        const timeoutModal = document.querySelector('[data-region="modal-container"] .modal-title');
        if (timeoutModal && timeoutModal.textContent.includes('会话超时')) {
            console.log("检测到会话超时对话框");
            handleSessionTimeoutDialog();
            return;
        }

        // 检查是否有包含"长时间未活动已退出"的对话框
        const timeoutBody = document.querySelector('[data-region="body"]');
        if (timeoutBody && timeoutBody.textContent.includes('长时间未活动已退出')) {
            console.log("检测到会话超时提示");
            handleSessionTimeoutDialog();
            return;
        }

        // 检查是否有会话超时模态框的通用检测
        const modal = document.querySelector('.modal.show');
        if (modal && modal.textContent.includes('会话超时')) {
            console.log("检测到会话超时对话框");
            handleSessionTimeoutDialog();
        }
    }

    function handleSessionTimeoutDialog() {
        // 点击"再次登录"按钮
        const loginButton = document.querySelector('[data-action="save"]');
        if (loginButton) {
            console.log("点击'再次登录'按钮");
            loginButton.click();
            return;
        }

        // 如果没有找到特定按钮，尝试找到包含"登录"文字的按钮
        const buttons = document.querySelectorAll('button');
        for (let button of buttons) {
            if (button.textContent.includes('登录') || button.textContent.includes('再次登录')) {
                console.log("点击检测到的登录按钮");
                button.click();
                break;
            }
        }
    }

})();
