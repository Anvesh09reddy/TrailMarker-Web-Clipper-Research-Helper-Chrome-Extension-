// content.js - FINAL STABLE VERSION

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_SELECTION_DETAILS') {
    const selection = window.getSelection();
    const text = selection.toString().trim();
    if (text) {
      // Pass the selector of the common ancestor container for better accuracy
      const range = selection.getRangeAt(0);
      const selector = getCssSelector(range.commonAncestorContainer.parentElement);
      sendResponse({ text, selector });
    }
    // Ensure you always send a response to avoid issues
    return true; 
  }
});

// This is a more robust selector generator to handle more cases
function getCssSelector(el) {
    if (!(el instanceof Element)) return;
    const path = [];
    while (el.nodeType === Node.ELEMENT_NODE) {
        let selector = el.nodeName.toLowerCase();
        if (el.id) {
            selector = `#${el.id}`;
            path.unshift(selector);
            break;
        } else {
            let sib = el, nth = 1;
            while (sib = sib.previousElementSibling) {
                if (sib.nodeName.toLowerCase() === selector) nth++;
            }
            if (nth !== 1) {
                selector += `:nth-of-type(${nth})`;
            }
        }
        path.unshift(selector);
        el = el.parentNode;
    }
    return path.join(' > ');
}