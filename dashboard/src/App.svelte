<script>
  import Sidebar from './lib/Sidebar.svelte';
  import ChatInterface from './lib/ChatInterface.svelte';

  let theme = 'dark';

  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
  }

  $: isDark = theme === 'dark';
</script>

<main class="app" class:dark={isDark} class:light={!isDark}>
  <!-- Background Accents -->
  <div class="bg-accents">
    <div class="accent accent-teal"></div>
    <div class="accent accent-blue"></div>
  </div>

  <Sidebar {theme} on:toggleTheme={toggleTheme} />
  
  <div class="content">
    <ChatInterface {theme} />
  </div>

  <!-- Keyboard Shortcut Hint -->
  <div class="shortcut-hint">
    <span><kbd>⌘</kbd> K</span>
    <span class="hint-text">SEARCH ANYWHERE</span>
  </div>
</main>

<style>
  :global(*) {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  :global(body) {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    overflow-x: hidden;
  }

  .app {
    position: relative;
    min-height: 100vh;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.7s;
    overflow-x: hidden;
  }

  .app.dark {
    background-color: #050505;
  }

  .app.light {
    background-color: #fcfcfc;
  }

  .bg-accents {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }

  .accent {
    position: absolute;
    border-radius: 50%;
    filter: blur(120px);
    transition: opacity 1s;
  }

  .accent-teal {
    top: -10%;
    left: -10%;
    width: 40%;
    height: 40%;
  }

  .dark .accent-teal {
    background: rgba(45, 212, 191, 0.05);
    opacity: 0.5;
  }

  .light .accent-teal {
    background: rgba(45, 212, 191, 0.1);
    opacity: 0.3;
  }

  .accent-blue {
    bottom: -10%;
    right: -10%;
    width: 40%;
    height: 40%;
  }

  .dark .accent-blue {
    background: rgba(59, 130, 246, 0.05);
    opacity: 0.5;
  }

  .light .accent-blue {
    background: rgba(59, 130, 246, 0.1);
    opacity: 0.3;
  }

  .content {
    position: relative;
    width: 100%;
    display: flex;
    justify-content: center;
    z-index: 10;
    padding: 80px 0;
  }

  .shortcut-hint {
    position: fixed;
    bottom: 24px;
    right: 24px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.05em;
    transition: opacity 0.5s;
  }

  .dark .shortcut-hint {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #6b7280;
  }

  .light .shortcut-hint {
    background: rgba(0, 0, 0, 0.05);
    border: 1px solid rgba(0, 0, 0, 0.05);
    color: #9ca3af;
  }

  .shortcut-hint kbd {
    font-family: inherit;
  }

  .hint-text {
    opacity: 0.4;
  }
</style>
