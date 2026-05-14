/**
 * 回放初始化脚本
 * 检测URL参数中是否包含回放请求,如果有则自动启动回放
 */

// 保存当前任务状态的快照，以便退出回放时恢复
let savedTaskState = null;

// 检查URL参数是否包含回放请求
function checkReplayRequest() {
    const urlParams = new URLSearchParams(window.location.search);
    const isReplay = urlParams.get('replay') === 'true';
    const workspacePath = urlParams.get('workspace');
    
    if (isReplay && workspacePath) {
        console.log('检测到回放请求:', workspacePath);
        
        // 保存当前任务状态（如果有），以便退出回放时恢复
        saveCurrentTaskState();
        
        // 切换到主界面
        if (typeof hideInitialInputAndShowMain === 'function') {
            hideInitialInputAndShowMain('');
        }
        
        // 显示回放状态提示和退出回放按钮
        showReplayStatus();
        showExitReplayButton();
        
        // 延迟启动回放,确保WebSocket已连接
        setTimeout(() => {
            startReplayFromWorkspace(workspacePath);
        }, 1000);
        
        return true;
    }
    
    return false;
}

// 保存当前任务状态
function saveCurrentTaskState() {
    try {
        const lastManusStep = localStorage.getItem('cosight:lastManusStep');
        const stepToolEvents = localStorage.getItem('cosight:stepToolEvents');
        const planIdByTopic = localStorage.getItem('cosight:planIdByTopic');
        const pendingRequests = localStorage.getItem('cosight:pendingRequests');
        
        if (lastManusStep || stepToolEvents) {
            savedTaskState = {
                lastManusStep: lastManusStep,
                stepToolEvents: stepToolEvents,
                planIdByTopic: planIdByTopic,
                pendingRequests: pendingRequests,
                savedAt: Date.now()
            };
            // 保存到sessionStorage，这样即使页面刷新也能恢复
            sessionStorage.setItem('cosight:savedTaskState', JSON.stringify(savedTaskState));
            console.log('✓ 当前任务状态已保存');
        } else {
            console.log('没有正在进行的任务状态需要保存');
        }
    } catch (e) {
        console.warn('保存任务状态失败:', e);
    }
}

// 恢复当前任务状态（退出回放时调用）
function restoreCurrentTaskState() {
    try {
        // 先从sessionStorage恢复
        const savedRaw = sessionStorage.getItem('cosight:savedTaskState');
        if (savedRaw) {
            savedTaskState = JSON.parse(savedRaw);
            sessionStorage.removeItem('cosight:savedTaskState');
        }
        
        if (!savedTaskState) {
            console.log('没有保存的任务状态需要恢复');
            return false;
        }
        
        // 恢复localStorage中的任务状态
        if (savedTaskState.lastManusStep) {
            localStorage.setItem('cosight:lastManusStep', savedTaskState.lastManusStep);
        }
        if (savedTaskState.stepToolEvents) {
            localStorage.setItem('cosight:stepToolEvents', savedTaskState.stepToolEvents);
        }
        if (savedTaskState.planIdByTopic) {
            localStorage.setItem('cosight:planIdByTopic', savedTaskState.planIdByTopic);
        }
        if (savedTaskState.pendingRequests) {
            localStorage.setItem('cosight:pendingRequests', savedTaskState.pendingRequests);
        }
        
        console.log('✓ 当前任务状态已恢复');
        return true;
    } catch (e) {
        console.warn('恢复任务状态失败:', e);
        return false;
    }
}

// 退出回放模式，返回当前任务
function exitReplayMode() {
    console.log('========== 退出回放模式 ==========');
    
    // 恢复任务状态
    const restored = restoreCurrentTaskState();
    
    // 移除回放标识和退出按钮
    const badge = document.querySelector('.replay-badge');
    if (badge) {
        badge.remove();
    }
    const exitBtn = document.querySelector('.exit-replay-btn');
    if (exitBtn) {
        exitBtn.remove();
    }
    
    // 清理回放相关的UI状态
    try {
        if (typeof window.resetSessionCaches === 'function') {
            window.resetSessionCaches();
        }
    } catch (e) {
        console.warn('清理回放状态失败:', e);
    }
    
    if (restored) {
        // 重新加载页面以恢复DAG图
        // 使用sessionStorage标记，避免localStorage被清空
        sessionStorage.setItem('cosight:returnToCurrentTask', 'true');
        window.location.reload();
    } else {
        // 没有保存的任务状态，刷新页面回到初始状态
        window.location.reload();
    }
}

// 从工作区启动回放
function startReplayFromWorkspace(workspacePath) {
    console.log('========== 开始回放 ==========');
    console.log('工作区路径:', workspacePath);
    console.log('当前URL:', window.location.href);
    console.log('WebSocket状态:', window.WebSocketService ? window.WebSocketService.isOpen : 'WebSocket未初始化');
    
    // 清理现有状态（但保留已保存的任务状态快照）
    try {
        if (typeof window.resetSessionCaches === 'function') {
            window.resetSessionCaches();
            console.log('✓ 会话缓存已清理');
        }
    } catch (e) {
        console.warn('清理状态失败:', e);
    }
    
    // 提取replayPlanId (如果需要的话)
    let replayPlanId = null;
    try {
        // 从localStorage中查找该workspace对应的planId
        const planIdMap = localStorage.getItem('cosight:planIdByTopic');
        if (planIdMap) {
            const map = JSON.parse(planIdMap);
            // 查找与该workspace匹配的planId
            for (const [topic, planId] of Object.entries(map)) {
                replayPlanId = planId;
                break;
            }
        }
        console.log('replayPlanId:', replayPlanId || '(未找到)');
    } catch (e) {
        console.warn('获取planId失败:', e);
    }
    
    // 发送回放请求
    if (window.messageService && typeof window.messageService.sendReplay === 'function') {
        console.log('✓ messageService可用，准备发送回放请求');
        console.log('回放参数:', {
            workspacePath: workspacePath,
            replayPlanId: replayPlanId
        });
        
        try {
            window.messageService.sendReplay(workspacePath, replayPlanId);
            console.log('✓ 回放请求已发送');
        } catch (e) {
            console.error('✗ 发送回放请求失败:', e);
            alert('发送回放请求失败: ' + e.message);
        }
    } else {
        console.error('✗ messageService不可用');
        console.log('messageService:', window.messageService);
        alert('消息服务未初始化，请刷新页面重试');
    }
    
    console.log('========== 回放请求完成 ==========');
}

// 显示回放状态
function showReplayStatus() {
    // 在标题旁边显示回放标识
    const header = document.querySelector('.header h1');
    if (header && !document.querySelector('.replay-badge')) {
        const badge = document.createElement('span');
        badge.className = 'replay-badge';
        badge.innerHTML = '<i class="fas fa-history"></i> 回放模式';
        header.appendChild(badge);
    }
}

// 显示退出回放按钮
function showExitReplayButton() {
    const header = document.querySelector('.header');
    if (header && !document.querySelector('.exit-replay-btn')) {
        const exitBtn = document.createElement('button');
        exitBtn.className = 'exit-replay-btn';
        exitBtn.innerHTML = '<i class="fas fa-stop"></i> 退出回放';
        exitBtn.title = '退出回放模式，返回当前任务';
        exitBtn.onclick = exitReplayMode;
        header.appendChild(exitBtn);
    }
}

// 页面加载完成后检查回放请求
window.addEventListener('DOMContentLoaded', () => {
    // 等待WebSocket连接
    if (window.WebSocketService && window.WebSocketService.websocketConnected) {
        window.WebSocketService.websocketConnected.addEventListener('connected', () => {
            setTimeout(() => {
                checkReplayRequest();
            }, 500);
        }, { once: true });
    } else {
        // 如果WebSocket还未初始化,延迟检查
        setTimeout(() => {
            checkReplayRequest();
        }, 1500);
    }
});

// 导出函数供其他模块使用
if (typeof window !== 'undefined') {
    window.checkReplayRequest = checkReplayRequest;
    window.startReplayFromWorkspace = startReplayFromWorkspace;
    window.exitReplayMode = exitReplayMode;
    window.saveCurrentTaskState = saveCurrentTaskState;
    window.restoreCurrentTaskState = restoreCurrentTaskState;
}


