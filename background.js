// background.js - FINAL STABLE VERSION

// On install, create a parent context menu and a default thread
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "sidescribe-parent",
    title: "Add to SideScribe",
    contexts: ["selection"]
  });
  
  chrome.storage.local.get({ threads: [] }, (data) => {
    if (data.threads.length === 0) {
      const initialThreadId = `thread-${Date.now()}`;
      chrome.storage.local.set({
        threads: [{ id: initialThreadId, name: "My First Thread", snippets: [] }]
      });
    }
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab.url?.startsWith('http')) {
    console.log("SideScribe: Cannot run on a special page:", tab.url);
    return;
  }

  const threadId = info.menuItemId.replace('add-to-thread-', '');
  
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_SELECTION_DETAILS' });
    if (response && response.text) {
      saveSnippet(threadId, response.text, response.selector, tab);
    }
  } catch (error) {
    // This is EXPECTED behavior on pages that are still loading or restricted.
    // It prevents a crash by catching the connection error.
    console.warn(`SideScribe: Could not establish connection with the content script. This is normal on some pages. Error: ${error.message}`);
  }
});

async function saveSnippet(threadId, text, selector, tab) {
  const { threads } = await chrome.storage.local.get({ threads: [] });
  const thread = threads.find(t => t.id === threadId);

  if (thread) {
    thread.snippets.push({
      id: `snippet-${Date.now()}`,
      text: text,
      url: tab.url,
      title: tab.title,
      selector: selector,
      note: "",
      date: new Date().toISOString()
    });
    await chrome.storage.local.set({ threads });
  }
}

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'UPDATE_CONTEXT_MENUS') {
        updateContextMenus(message.threads);
        return true; 
    }
});

function updateContextMenus(threads) {
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
            id: 'sidescribe-parent',
            title: 'Add to SideScribe',
            contexts: ['selection'],
        });

        if (!threads || threads.length === 0) return;

        threads.forEach(thread => {
            chrome.contextMenus.create({
                id: `add-to-thread-${thread.id}`,
                parentId: 'sidescribe-parent',
                title: thread.name,
                contexts: ['selection'],
            });
        });
    });
}