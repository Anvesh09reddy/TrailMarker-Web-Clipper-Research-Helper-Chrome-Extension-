document.addEventListener('DOMContentLoaded', () => {
    loadThreads();
    document.getElementById('add-thread-btn').addEventListener('click', createNewThread);
    chrome.storage.onChanged.addListener(loadThreads);
});

async function getStorageData(key) {
    return new Promise((resolve) => {
        chrome.storage.local.get(key, (result) => resolve(result[key]));
    });
}

async function loadThreads() {
    const container = document.getElementById('threads-container');
    container.innerHTML = '';
    
    const threads = await getStorageData('threads') || [];
    
    // Inform background script to update context menus
    chrome.runtime.sendMessage({ type: 'UPDATE_CONTEXT_MENUS', threads });

    if (threads.length > 0) {
        threads.forEach(thread => {
            const threadDiv = createThreadElement(thread);
            container.appendChild(threadDiv);
        });
    }
}

async function createNewThread() {
    const input = document.getElementById('new-thread-name');
    const name = input.value.trim();
    if (!name) return;

    const threads = await getStorageData('threads') || [];
    const newThread = {
        id: `thread-${Date.now()}`,
        name: name,
        snippets: []
    };
    threads.push(newThread);
    chrome.storage.local.set({ threads }, () => {
        input.value = '';
        // The onChanged listener will handle reloading
    });
}

function createThreadElement(thread) {
    const threadDiv = document.createElement('div');
    threadDiv.className = 'thread';
    threadDiv.innerHTML = `
        <div class="thread-header">
            <h2 class="thread-title">${thread.name}</h2>
            <div class="thread-actions">
                <button class="export-btn" title="Copy to Clipboard">📋</button>
                <button class="delete-thread-btn" title="Delete Thread">🗑️</button>
            </div>
        </div>
        <div class="snippets-container"></div>
    `;

    // Add event listeners
    threadDiv.querySelector('.delete-thread-btn').addEventListener('click', () => deleteThread(thread.id));
    threadDiv.querySelector('.export-btn').addEventListener('click', () => exportThread(thread));

    const snippetsContainer = threadDiv.querySelector('.snippets-container');
    if (thread.snippets && thread.snippets.length > 0) {
        thread.snippets.slice().reverse().forEach(snippet => {
            snippetsContainer.appendChild(createSnippetElement(thread.id, snippet));
        });
    }

    return threadDiv;
}

function createSnippetElement(threadId, snippet) {
    const snippetDiv = document.createElement('div');
    snippetDiv.className = 'snippet';
    snippetDiv.innerHTML = `
        <p class="snippet-text">"${snippet.text}"</p>
        <p class="snippet-source"><a data-url="${snippet.url}" data-selector="${snippet.selector}">${snippet.title || new URL(snippet.url).hostname}</a></p>
        <textarea class="snippet-note" placeholder="Add a note...">${snippet.note || ''}</textarea>
    `;

    // Add event listeners
    snippetDiv.querySelector('a').addEventListener('click', handleSnippetClick);
    const noteTextarea = snippetDiv.querySelector('.snippet-note');
    noteTextarea.addEventListener('change', (e) => saveNote(threadId, snippet.id, e.target.value));

    return snippetDiv;
}

async function handleSnippetClick(event) {
    event.preventDefault();
    const url = event.target.dataset.url;
    const selector = event.target.dataset.selector;
    
    // Find an existing tab with the URL or create a new one
    const tabs = await chrome.tabs.query({ url });
    if (tabs.length > 0) {
        await chrome.tabs.update(tabs[0].id, { active: true });
        chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: scrollToAndHighlight,
            args: [selector]
        });
    } else {
        const newTab = await chrome.tabs.create({ url: url, active: true });
        // Listen for the tab to be fully loaded before injecting the script
        chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
            if (tabId === newTab.id && info.status === 'complete') {
                chrome.scripting.executeScript({
                    target: { tabId: newTab.id },
                    func: scrollToAndHighlight,
                    args: [selector]
                });
                chrome.tabs.onUpdated.removeListener(listener);
            }
        });
    }
}

// This function will be injected into the target tab, so it must be self-contained
function scrollToAndHighlight(selector) {
    const element = document.querySelector(selector);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const originalStyle = element.style.backgroundColor;
        element.style.backgroundColor = '#FFFB7D'; // A pleasant yellow
        element.style.transition = 'background-color 0.5s';
        setTimeout(() => {
            element.style.backgroundColor = originalStyle;
        }, 2500);
    }
}


async function deleteThread(threadId) {
    if (!confirm("Are you sure you want to delete this entire thread?")) return;
    let { threads } = await chrome.storage.local.get({ threads: [] });
    threads = threads.filter(t => t.id !== threadId);
    chrome.storage.local.set({ threads });
}

async function saveNote(threadId, snippetId, noteText) {
    let { threads } = await chrome.storage.local.get({ threads: [] });
    const thread = threads.find(t => t.id === threadId);
    if (thread) {
        const snippet = thread.snippets.find(s => s.id === snippetId);
        if (snippet) {
            snippet.note = noteText;
            chrome.storage.local.set({ threads });
        }
    }
}

function exportThread(thread) {
    let output = `${thread.name}\n====================\n\n`;
    thread.snippets.forEach(snippet => {
        output += `Snippet: "${snippet.text}"\n`;
        if (snippet.note) {
            output += `Note: ${snippet.note}\n`;
        }
        output += `Source: ${snippet.url}\n\n`;
    });
    navigator.clipboard.writeText(output).then(() => {
        alert(`'${thread.name}' copied to clipboard!`);
    }).catch(err => {
        console.error('Failed to copy thread: ', err);
    });
}