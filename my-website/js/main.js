// Main JavaScript file
document.addEventListener('DOMContentLoaded', () => {
    console.log('WTTP test site loaded successfully');
    
    // Add a timestamp to show when the page was loaded
    const footer = document.querySelector('footer');
    const timestamp = document.createElement('p');
    timestamp.textContent = `Page loaded: ${new Date().toLocaleString()}`;
    footer.appendChild(timestamp);
});
