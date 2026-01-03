// ============================================
// INFOMARY HEALTH BOT - CUSTOM JAVASCRIPT
// ============================================

console.log('🏥 Infomary Health Bot - Custom JS Loaded');

// ============================================
// HIDE AUDIO MESSAGES
// ============================================

function hideAudioMessages() {
    // Hide all steps and messages that contain audio elements
    document.querySelectorAll('.step, .message, .step-content, .message-content').forEach(element => {
        if (element.querySelector('audio')) {
            element.style.display = 'none';
            element.style.visibility = 'hidden';
            element.style.height = '0';
            element.style.overflow = 'hidden';
            element.style.opacity = '0';
        }
    });
}

// Run on page load
window.addEventListener('DOMContentLoaded', hideAudioMessages);
window.addEventListener('load', hideAudioMessages);

// Watch for new audio elements being added
const audioObserver = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
        mutation.addedNodes.forEach(function(node) {
            if (node.nodeType === 1) {
                if (node.querySelector && node.querySelector('audio')) {
                    node.style.display = 'none';
                    node.style.visibility = 'hidden';
                    node.style.height = '0';
                    node.style.overflow = 'hidden';
                    node.style.opacity = '0';
                }
            }
        });
    });
});

audioObserver.observe(document.body, { 
    childList: true, 
    subtree: true 
});

// ============================================
// HIDE CHAINLIT BRANDING
// ============================================

function hideChainlitBranding() {
    // Hide GitHub links
    document.querySelectorAll('a').forEach(link => {
        if (link.href && (
            link.href.includes('github.com/Chainlit') || 
            link.href.includes('chainlit.io') ||
            link.href.includes('docs.chainlit.io')
        )) {
            link.style.display = 'none';
            link.style.visibility = 'hidden';
            link.style.opacity = '0';
            link.remove();
        }
    });

    // Hide "Built with Chainlit" text
    document.querySelectorAll('footer, .footer, [class*="footer"]').forEach(footer => {
        const text = footer.textContent || footer.innerText;
        if (text && text.toLowerCase().includes('chainlit')) {
            footer.style.display = 'none';
            footer.remove();
        }
    });

    // Hide any chainlit watermark
    document.querySelectorAll('[class*="watermark"], [id*="watermark"]').forEach(el => {
        el.style.display = 'none';
        el.remove();
    });
}

// Run immediately and periodically
hideChainlitBranding();
setInterval(hideChainlitBranding, 1000);

// ============================================
// ENHANCE USER MENU VISIBILITY
// ============================================

function enhanceUserMenu() {
    setTimeout(() => {
        // Find user menu button
        const userMenuButton = document.querySelector('[aria-label="User menu"]') || 
                               document.querySelector('[aria-controls="user-menu"]') ||
                               document.querySelector('.MuiIconButton-root:has(.MuiAvatar-root)');
        
        if (userMenuButton) {
            console.log('✅ User menu button found');
            
            // Make sure it's visible
            userMenuButton.style.opacity = '1';
            userMenuButton.style.visibility = 'visible';
            userMenuButton.style.display = 'flex';
            
            // Find and style the avatar
            const avatar = userMenuButton.querySelector('.MuiAvatar-root');
            if (avatar) {
                avatar.style.background = '#E91E63';
                avatar.style.color = 'white';
                avatar.style.fontWeight = '600';
            }
        }

        // Ensure menu items are visible when menu opens
        const menuItems = document.querySelectorAll('.MuiMenuItem-root, .MuiListItem-root');
        menuItems.forEach(item => {
            item.style.color = 'var(--foreground)';
            item.style.opacity = '1';
            item.style.visibility = 'visible';
        });

        // Make user info text visible
        const userInfo = document.querySelectorAll('.MuiTypography-subtitle1, .MuiTypography-body2');
        userInfo.forEach(text => {
            text.style.color = 'var(--foreground)';
            text.style.opacity = '1';
            text.style.visibility = 'visible';
        });
    }, 500);
}

// Run on load and when menu opens
window.addEventListener('DOMContentLoaded', enhanceUserMenu);
window.addEventListener('load', enhanceUserMenu);
document.addEventListener('click', enhanceUserMenu);

// ============================================
// ENHANCE AUTHENTICATION PAGE
// ============================================

function enhanceAuthPage() {
    const authElements = document.querySelectorAll(
        '.MuiTextField-root, .MuiButton-root, .MuiTypography-root, input, button'
    );
    
    authElements.forEach(el => {
        el.style.opacity = '1';
        el.style.visibility = 'visible';
        
        // Make text visible
        if (el.tagName === 'INPUT' || el.tagName === 'BUTTON') {
            el.style.color = 'var(--foreground)';
        }
    });

    // Make sure labels are visible
    document.querySelectorAll('.MuiFormLabel-root, label').forEach(label => {
        label.style.color = 'var(--muted-foreground)';
        label.style.opacity = '1';
        label.style.visibility = 'visible';
    });

    // Make titles visible
    document.querySelectorAll('.MuiTypography-h4, .MuiTypography-h5, .MuiTypography-h6').forEach(title => {
        title.style.color = 'var(--foreground)';
        title.style.opacity = '1';
        title.style.visibility = 'visible';
        title.style.fontWeight = '700';
    });

    // Make subtitles visible
    document.querySelectorAll('.MuiTypography-body1, .MuiTypography-body2').forEach(text => {
        text.style.color = 'var(--muted-foreground)';
        text.style.opacity = '1';
        text.style.visibility = 'visible';
    });
}

// Check for auth page
const authPageObserver = new MutationObserver(enhanceAuthPage);
authPageObserver.observe(document.body, { childList: true, subtree: true });

if (window.location.pathname.includes('login') || window.location.pathname.includes('auth')) {
    enhanceAuthPage();
    setInterval(enhanceAuthPage, 500);
}

// ============================================
// AUTO-FOCUS INPUT ON LOAD
// ============================================

function focusInput() {
    setTimeout(() => {
        const input = document.querySelector('#chat-input') ||
                     document.querySelector('textarea') ||
                     document.querySelector('input[type="text"]') ||
                     document.querySelector('.MuiInputBase-input');
        
        if (input && !input.value) {
            input.focus();
        }
    }, 500);
}

window.addEventListener('load', focusInput);

// ============================================
// SMOOTH SCROLLING
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    const chatContainer = document.querySelector('#chat-container') ||
                         document.querySelector('.MuiContainer-root') ||
                         document.querySelector('main');
    
    if (chatContainer) {
        chatContainer.style.scrollBehavior = 'smooth';
    }

    // Auto scroll to bottom on new messages
    const scrollObserver = new MutationObserver(() => {
        if (chatContainer) {
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
    });

    if (chatContainer) {
        scrollObserver.observe(chatContainer, { childList: true, subtree: true });
    }
});

// ============================================
// KEYBOARD SHORTCUTS
// ============================================

document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + K to focus input
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const input = document.querySelector('#chat-input') ||
                     document.querySelector('textarea') ||
                     document.querySelector('.MuiInputBase-input');
        if (input) input.focus();
    }
    
    // Escape to clear input
    if (e.key === 'Escape') {
        const input = document.querySelector('#chat-input') ||
                     document.querySelector('textarea') ||
                     document.querySelector('.MuiInputBase-input');
        if (input && document.activeElement === input) {
            input.value = '';
        }
    }
});

// ============================================
// FIX TEXT VISIBILITY GLOBALLY
// ============================================

function fixTextVisibility() {
    // Make all text elements visible
    document.querySelectorAll('p, span, div, label, button, input, textarea, h1, h2, h3, h4, h5, h6').forEach(el => {
        if (el.textContent.trim()) {
            el.style.opacity = '1';
            el.style.visibility = 'visible';
        }
    });

    // Specifically target MUI elements
    document.querySelectorAll('[class*="Mui"]').forEach(el => {
        if (el.textContent.trim()) {
            el.style.opacity = '1';
            el.style.visibility = 'visible';
        }
    });
}

// Run periodically to catch all elements
setInterval(fixTextVisibility, 1000);

// ============================================
// CONSOLE WELCOME MESSAGE
// ============================================

console.log('%c🏥 Infomary Health Bot', 'color: #E91E63; font-size: 24px; font-weight: bold;');
console.log('%cWelcome to your AI-powered health assistant!', 'color: #666; font-size: 14px;');
console.log('%cVersion: 1.0.0', 'color: #999; font-size: 12px;');

// ============================================
// ERROR HANDLING
// ============================================

window.addEventListener('error', (e) => {
    console.error('❌ JavaScript Error:', e.error);
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('❌ Unhandled Promise Rejection:', e.reason);
});

// ============================================
// INITIALIZE ON LOAD
// ============================================

window.addEventListener('DOMContentLoaded', () => {
    console.log('✅ Infomary Health Bot initialized');
    hideAudioMessages();
    hideChainlitBranding();
    enhanceUserMenu();
    enhanceAuthPage();
    fixTextVisibility();
});