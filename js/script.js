let messages = [];
let messageIdCounter = 0;
var sessionId;
var promptId;

// Define the avatar URLs
const LOCAL_USER_AVATAR = "user_pfp.png";
const REMOTE_USER_AVATAR = "silverwolf_pfp.png";
const SERVER_URL = "http://localhost:8008";

const chatInput = document.getElementById('chat-input');
const sendButton = document.getElementById('sendButton');
const regenButton = document.getElementById('regenButton');
const ptidInput = document.getElementById('ptID-input');
const ptidSubmit = document.getElementById('ptID-button');
const sessionIdDisplay = document.getElementById('session-id');
const sessionStatusDisplay = document.getElementById('session-status');
const ptidDisplay = document.getElementById('ptID-display');
const promptDisplay = document.getElementById('prompt-text');

// add event listeners

window.onload = function() {
    toastr.options.timeOut = 1000;
    // If there are no existing sessionId and promptId, make a request to /api/new_session
    if (!sessionId && !promptId) {
        fetch(SERVER_URL+'/api/new_session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        })
        .then(response => {
            if (!response.ok) {
                let error = new Error(`HTTP error! status: ${response.status}`);
                error.errorCode = response.status;
                throw error;
            }
            return response.json();
        })
        .then(data => {
            sessionId = data.session_id;
            promptId = data.prompt_id;
            sessionIdDisplay.textContent = sessionId;
            sessionIdDisplay.style.color = '#6BCB77bf';
            sessionStatusDisplay.className = 'fas fa-lock fa-sm';
            sessionStatusDisplay.style.color = '#6BCB77bf';
            ptidDisplay.textContent = "PtID | "+promptId;
            promptDisplay.textContent = "Prompt: "+data.prompt;
        })
        .catch((error) => {
            console.error('[Get-Session] Error:', error.message);
            // show error message in chat
            appendMessage(false, '连不上服务器。刷新一下试试？还是说这垃圾服务器又寄了......', 'Silver Wolf');
            document.querySelector('#message-input').style.display = 'none';
            document.querySelector('#generating').style.display = 'flex';
            document.querySelector('#generating').textContent = '[Get-Session] Error: '+error.message;
        });
    }
};

window.addEventListener('resize', function() {
    adjustVideoSize();
});  
window.addEventListener('orientationchange', function() {
    adjustVideoSize();
});
window.addEventListener('DOMContentLoaded', function() {
    document.getElementById('bgvideo').addEventListener('loadedmetadata', adjustVideoSize);
});

sendButton.addEventListener('click', function() {
    sendMessage(chatInput.value);
    chatInput.value = '';
    chatInput.style.height = '20px'
});
regenButton.addEventListener('click', function() {
    regenerateMessage();
});

chatInput.addEventListener('keydown', function(event) {
  if (event.key === 'Enter') {
    if (!event.shiftKey) {
      event.preventDefault();
      sendMessage(chatInput.value);
      chatInput.value = '';
    } else {
      // Allow the newline to be entered
      this.style.height = '38px';
    }
  }
});

chatInput.addEventListener('keyup', function(event) {
  if (this.value.split('\n').length <= 1) {
    this.style.height = '20px';
  }
});

document.querySelector('#positiveButton').addEventListener('click', function() {
    submitFeedback(1);
});
  
document.querySelector('#negativeButton').addEventListener('click', function() {
    submitFeedback(0);
});

document.querySelector('#regenerateButton').addEventListener('click', function() {
    submitFeedback(-1);
});

ptidSubmit.addEventListener('click', function() {
    updatePtID();
});

ptidInput.addEventListener('input', function(evt) {
    // Store current cursor position
    let cursorPosition = this.selectionStart;
    
    // If the 4th or 9th character is being typed, add the hyphen before
    if ((cursorPosition === 4 || cursorPosition === 9) && evt.data) {
        this.value = this.value.slice(0, cursorPosition) + '-' + this.value.slice(cursorPosition);
        cursorPosition++;  // Increment cursor position
    }

    // If the 5th or 9th character is being typed and it's not a hyphen, add the hyphen before
    if ((cursorPosition === 5 || cursorPosition === 10) && this.value[cursorPosition - 1] !== '-') {
        this.value = this.value.slice(0, cursorPosition - 1) + '-' + this.value.slice(cursorPosition - 1);
        cursorPosition++;  // Increment cursor position
    }

    this.setSelectionRange(cursorPosition, cursorPosition);
});

// add click events

$(".user").each(function() {
    $(this).data("expanded", false);
});

$(".user").click(function() {
    var arrowIcon = $(this).find(".arrow");
    var subBoxes = $(this).siblings(".user-sub-box");
    var SPsubBoxes = $(this).siblings(".setting-sub-box");
    
    var isExpanded = $(this).data("expanded");
    
    if (isExpanded) {
        arrowIcon.css("transform", "rotate(0deg)");
    } else {
        arrowIcon.css("transform", "rotate(90deg)");
    }

    isExpanded = !isExpanded;
    $(this).data("expanded", isExpanded);

    SPsubBoxes.slideToggle("fast");
    subBoxes.slideToggle("fast");
});

$(".user-sub-box").click(function() {
    $(".user-sub-box").removeClass("conversation-highlight");
    $(this).addClass("conversation-highlight");
});

// functions

function sendMessage(message) {
    if (message !== '') {
        appendMessage(true, message, 'You')
        scrollToBottom();
        setTimeout(function() {
            var msg_id = appendMessage(false, message, 'Silver Wolf')    // add remote message (placeholder)
            scrollToBottom();
            document.querySelector('#message-input').style.display = 'none';
            document.querySelector('#generating').style.display = 'flex';
  
            // Generate a response
            var msg = getMessageById(msg_id)
            var messageBubble = msg.element.querySelector('div .message-text');
            messageBubble.textContent = '';
            messageBubble.className += ' loadingDots';
            if (!sessionId) {
                // do nothing
            } else {
                fetch(SERVER_URL+'/api/gen', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ session_id: sessionId, message: message })
                })
                .then(response => {
                    if (!response.ok) {
                        let error = new Error(`HTTP error! status: ${response.status}`);
                        error.errorCode = response.status;
                        throw error;
                    }
                    return response.json();
                })
                .then(data => {
                    if (msg) msg.content = data.text;
                    messageBubble.textContent = data.text;
                    messageBubble.className = messageBubble.className.replace(' loadingDots', '');
                    scrollToBottom();
        
                    // Then swap the forms
                    document.querySelector('#generating').style.display = 'none';
                    document.querySelector('#feedback').style.display = 'flex';
                })
                .catch(error => {
                    console.error('[Generate-Response] Error:', error.message);
                    let err = error.message;

                    // show error message
                    if (err == 'Failed to fetch') { // cannot reach server
                        if (msg) msg.content = 'CANNOT_REACH_SERVER';
                        messageBubble.textContent = '连不上服务器。或许你可以试试再发一次？';
                        toastr.error('Failed to fetch!');

                    } else if (err.includes('HTTP error')) { // server response error
                        if (error.errorCode == 429) { // too many requests
                            if (msg) msg.content = 'TOO_MANY_REQUESTS';
                            messageBubble.textContent = '有点忙，待会再聊。 [429]'; 
                            toastr.error('HTTP error! status: 429 Too Many Requests');
                        } else if (error.errorCode == 400) { // bad request
                            if (msg) msg.content = 'BAD_REQUEST';
                            messageBubble.textContent = '请求出了点问题。再试一次试试？[400]'; 
                            toastr.error('HTTP error! status: 400 Bad Request');
                        } else if (error.errorCode == 500) { // internal server error
                            if (msg) msg.content = 'INTERNAL_SERVER_ERROR';
                            messageBubble.textContent = '服务器炸了。直接联系作者吧，不用刷新了，没救了。[500]'; 
                            toastr.error('HTTP error! status: 500 Internal Server Error');
                        }

                    } else { // unknown error
                        if (msg) msg.content = 'UNKNOWN_ERROR';
                        messageBubble.textContent = '出了奇奇怪怪的问题：'+err; 
                        toastr.error('Unknown error!');
                    }

                    messageBubble.className = messageBubble.className.replace(' loadingDots', '');

                    // Then swap the forms
                    document.querySelector('#generating').style.display = 'none';
                    document.querySelector('#feedback').style.display = 'flex';
                });
            }
        }, 500);
    }
} 

function regenerateMessage() {
    var lastRemoteMessage = messages[messages.length - 1];
    var lastLocalMessage = messages[messages.length - 2];
    document.querySelector('#message-input').style.display = 'none';
    document.querySelector('#generating').style.display = 'flex';
  
    // Regenerate a response
    var messageBubble = lastRemoteMessage.element.querySelector('div .message-text');
    var msg = lastRemoteMessage;
    messageBubble.textContent = '';
    messageBubble.className += ' loadingDots';

    // make request
    fetch(SERVER_URL+'/api/regen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId })
    })
    .then(response => {
        if (!response.ok) {
            let error = new Error(`HTTP error! status: ${response.status}`);
            error.errorCode = response.status;
            throw error;
        }
        return response.json();
    })
    .then(data => {
        if (msg) msg.content = data.text;
        messageBubble.textContent = data.text;
        messageBubble.className = messageBubble.className.replace(' loadingDots', '');
        scrollToBottom();

        // Then swap the forms
        document.querySelector('#generating').style.display = 'none';
        document.querySelector('#feedback').style.display = 'flex';
    })
    .catch(error => {
        console.error('[Regenerate-Response] Error:', error.message);
        let err = error.message;

        // show error message
        if (err == 'Failed to fetch') { // cannot reach server
            if (msg) msg.content = 'CANNOT_REACH_SERVER';
            messageBubble.textContent = '连不上服务器。或许你可以试试再发一次？';
            toastr.error('Failed to fetch!');

        } else if (err.includes('HTTP error')) { // server response error
            if (error.errorCode == 429) { // too many requests
                if (msg) msg.content = 'TOO_MANY_REQUESTS';
                messageBubble.textContent = '有点忙，待会再聊。 [429]'; 
                toastr.error('HTTP error! status: 429 Too Many Requests');
            } else if (error.errorCode == 400) { // bad request
                if (msg) msg.content = 'BAD_REQUEST';
                messageBubble.textContent = '请求出了点问题。再试一次试试？[400]'; 
                toastr.error('HTTP error! status: 400 Bad Request');
            } else if (error.errorCode == 500) { // internal server error
                if (msg) msg.content = 'INTERNAL_SERVER_ERROR';
                messageBubble.textContent = '服务器炸了。直接联系作者吧，不用刷新了，没救了。[500]'; 
                toastr.error('HTTP error! status: 500 Internal Server Error');
            }

        } else { // unknown error
            if (msg) msg.content = 'UNKNOWN_ERROR';
            messageBubble.textContent = '出了奇奇怪怪的问题：'+err; 
            toastr.error('Unknown error!');
        }

        messageBubble.className = messageBubble.className.replace(' loadingDots', '');

        // Then swap the forms
        document.querySelector('#generating').style.display = 'none';
        document.querySelector('#feedback').style.display = 'flex';
    });
}

function restoreChatInput() {
    // Clear the feedback and swap back to the chat input
    document.querySelector('#feedbackInput').value = '';
    document.querySelector('#message-input').style.display = 'flex';
    document.querySelector('#feedback').style.display = 'none';

    document.querySelector('#chat-input').focus();
}

// fetch with timeout
const fetchWithTimeout = (url, options = {}, timeout = 5000) => {
    return Promise.race([
        fetch(url, options),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request timed out')), timeout)
        )
    ]);
};

function submitFeedback(feedbackStatus) {
    const feedback = document.querySelector('#feedbackInput').value;
    console.log(`Feedback (${feedbackStatus}): ${feedback}`);
    
    if (feedbackStatus == -1) {
        // Regenerate the chat
        document.querySelector('#feedbackInput').value = '';
        document.querySelector('#feedback').style.display = 'none';
        restoreChatInput();
        regenerateMessage();
    } else {
        // Send the feedback to the server
        if (feedback == '') {
            // ignore empty feedback
            restoreChatInput();
        } else {
            // disable the feedback button
            document.querySelector('#positiveButton').disabled = true;
            document.querySelector('#negativeButton').disabled = true;
            document.querySelector('#feedbackInput').disabled = true;
            document.querySelector('#feedbackInput').value = '请稍等，我们正在根据您的反馈调整模型... 预计需要 20-40 秒。';

            toastr.info('正在提交反馈...');
            fetch(SERVER_URL+'/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: sessionId, feedback_text: feedback, feedback: feedbackStatus })
            })
            .then(response => {
                if (!response.ok) {
                    let error = new Error(`HTTP error! status: ${response.status}`);
                    error.errorCode = response.status;
                    throw error;
                }
                return response.json();
            })
            .then(data => {
                console.log('[Feedback-Task] Response:', data);
                toastr.success('反馈已提交，正在调整模型...');
                // Start polling for the task status
                let intervalId = setInterval(() => {
                    fetch(SERVER_URL+'/api/feedback_status?task_id='+data.task_id)
                    .then(response => {
                        if (!response.ok) {
                            let error = new Error(`HTTP error! status: ${response.status}`);
                            error.errorCode = response.status;
                            throw error;
                        }
                        return response.json();
                    })
                    .then(data => {
                        if (data.status === '2') {  // 2 means completed
                            // Stop polling
                            clearInterval(intervalId);
                            console.log('[Feedback] Task completed');
                            toastr.success('反馈成功！模型已经更新，立即生效。');
                            // save prompt and ptID
                            promptId = data.prompt_id;
                            ptidDisplay.textContent = "PtID | "+promptId;
                            promptDisplay.textContent = "Prompt: "+data.new_prompt;
                        } else if (data.status === '0') {    // 0 means failed
                            // Stop polling
                            clearInterval(intervalId);
                            console.log('[Feedback] Task failed SERVER_ERROR');
                            toastr.error('反馈失败：服务端错误');
                        } 
                        else {  // 1 means pending
                            console.log('[Feedback] Task still pending');
                        }
                    })
                    .catch(error => {
                        console.error('[Feedback] Error:', error.message);
                        let err = error.message;
                        toastr.error('反馈失败：'+err);
                        clearInterval(intervalId);
                    });
                }, 5000); // Poll every 5 seconds
            })
            .catch(error => {
                console.error('[Feedback] Error:', error.message);
                let err = error.message;
                toastr.error('反馈失败：'+err);
            })

            // Re-enable the feedback button
            document.querySelector('#positiveButton').disabled = false;
            document.querySelector('#negativeButton').disabled = false;
            document.querySelector('#feedbackInput').disabled = false;

            // Clear the feedback and swap back to the chat input
            document.querySelector('#feedbackInput').value = '';
            document.querySelector('#message-input').style.display = 'flex';
            document.querySelector('#feedback').style.display = 'none';

            document.querySelector('#chat-input').focus();
        }
    }
}  

function adjustVideoSize() {
    var video = document.getElementById('bgvideo');
    var windowAspectRatio = window.innerWidth / window.innerHeight;
    var videoAspectRatio = video.videoWidth / video.videoHeight;

    if (windowAspectRatio > videoAspectRatio) {
        video.style.width = '100vw';
        video.style.height = 'auto';
    } else {
        video.style.width = 'auto';
        video.style.height = '100vh';
    }
}

function appendMessage(isLocalUser, message, name) {
    const id = 'message-' + messageIdCounter++; // Generate unique ID

    const chatArea = document.getElementById('chat-dialogue');
  
    // create new message element
    const messageDiv = document.createElement('div');
  
    // choose class based on whether message is sent by local or remote user
    messageDiv.className = isLocalUser ? 'local-message' : 'remote-message';
  
    // Apply flexbox for horizontal alignment
    messageDiv.style.display = 'flex';
    //messageDiv.style.alignItems = 'center';
    messageDiv.style.justifyContent = isLocalUser ? 'flex-end' : 'flex-start';
  
    // Insert the user avatar
    const avatarElement = document.createElement('img');
    avatarElement.src = isLocalUser ? LOCAL_USER_AVATAR : REMOTE_USER_AVATAR;
    avatarElement.className = 'user-avatar';
    avatarElement.style.order = isLocalUser ? 2 : 1; // Use order property to control the order of flex items
  
    messageDiv.appendChild(avatarElement);
  
    // create a div for the username and content
    const nameContentDiv = document.createElement('div');
    nameContentDiv.style.display = 'flex';
    nameContentDiv.style.flexDirection = 'column';
    nameContentDiv.style.width = '100%';
    nameContentDiv.style.alignItems = isLocalUser ? 'flex-end' : 'flex-start';
    nameContentDiv.style.order = isLocalUser ? 1 : 2; // Use order property to control the order of flex items
  
    // Insert the user name
    const nameElement = document.createElement('div');
    nameElement.innerText = name;
    nameElement.className = 'user-name';
    nameContentDiv.appendChild(nameElement);
  
    // insert the actual message
    const messageElement = document.createElement('div');
    messageElement.innerText = message;
    messageElement.className = 'message-text';
    nameContentDiv.appendChild(messageElement);
  
    // add the username/content div to the message
    messageDiv.appendChild(nameContentDiv);
  
    // add the message to the chat area
    chatArea.appendChild(messageDiv);

    messages.push({
        id: id,
        sender: name,
        content: message,
        isLocalUser: isLocalUser,
        element: messageDiv
    });

    return id;
}  

function updatePtID() {
    const new_ptid = ptidInput.value;
    ptidInput.value = '';
    if (new_ptid === '') {
        toastr.warning('PtID 不能为空');
        return;
    } else {
        toastr.info('正在应用新的 PtID...');
        // update ptid
        fetch(SERVER_URL+'/api/set_promptid', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId, prompt_id: new_ptid})
        })
        .then(response => {
            if (!response.ok) {
                let error = new Error(`HTTP error! status: ${response.status}`);
                error.errorCode = response.status;
                throw error;
            }
            return response.json();
        })
        .then(data => {
            console.log('[Update-PtID] New PtID:', data.prompt_id);
            promptId = data.prompt_id;
            ptidDisplay.textContent = "PtID | "+promptId;
            promptDisplay.textContent = "Prompt: "+data.prompt;
            toastr.success('PtID 更新成功！');
        })
        .catch(error => {
            console.error('[Feedback] Error:', error.message);
            let err = error.message;
            toastr.error('PtID 更新失败: '+err);
        })
    }
}

// A function to get a message by its ID
function getMessageById(id) {
    return messages.find(m => m.id === id);
}

function scrollToBottom() {
    var dialogue = document.querySelector('#chat-dialogue');
    dialogue.scrollTop = dialogue.scrollHeight;
}