<script>
  import { createEventDispatcher } from 'svelte';
  
  export let theme = 'dark';
  
  const dispatch = createEventDispatcher();

  $: isDark = theme === 'dark';

  const navItems = [
    { id: 'new', icon: 'plus', label: 'New Chat', active: true },
    { id: 'history', icon: 'history', label: 'History', active: false },
    { id: 'topics', icon: 'message', label: 'Topics', active: false },
    { id: 'tools', icon: 'grid', label: 'Tools', active: false }
  ];

  function toggleTheme() {
    dispatch('toggleTheme');
  }
</script>

<aside class:dark={isDark} class:light={!isDark}>
  <div class="top">
    <!-- Logo -->
    <div class="logo">
      <span>E</span>
    </div>

    <!-- Nav Items -->
    <nav>
      {#each navItems as item}
        <button class="nav-item" class:active={item.active} aria-label={item.label}>
          {#if item.icon === 'plus'}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          {:else if item.icon === 'history'}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          {:else if item.icon === 'message'}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          {:else if item.icon === 'grid'}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
          {/if}
          <span class="tooltip">{item.label}</span>
        </button>
      {/each}
    </nav>
  </div>

  <div class="bottom">
    <!-- Theme Toggle -->
    <button class="icon-btn" on:click={toggleTheme} aria-label="Toggle theme">
      {#if isDark}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>
      {:else}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
      {/if}
    </button>

    <!-- Settings -->
    <button class="icon-btn" aria-label="Settings">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
      </svg>
    </button>
  </div>
</aside>

<style>
  aside {
    position: fixed;
    left: 0;
    top: 0;
    z-index: 50;
    height: 100%;
    width: 68px;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 24px 0;
    transition: background-color 0.5s, border-color 0.5s;
    border-right: 1px solid;
  }

  aside.dark {
    background: #0d0d0d;
    border-color: rgba(255, 255, 255, 0.05);
  }

  aside.light {
    background: #fcfcfc;
    border-color: rgba(0, 0, 0, 0.05);
  }

  .top {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 32px;
  }

  .logo {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    background: linear-gradient(135deg, #2dd4bf, #0d9488);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 20px rgba(45, 212, 191, 0.3);
    transition: transform 0.2s;
  }

  .logo:hover {
    transform: rotate(5deg) scale(1.05);
  }

  .logo span {
    color: white;
    font-weight: 700;
    font-size: 20px;
    line-height: 1;
  }

  nav {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }

  .nav-item {
    position: relative;
    padding: 10px;
    border-radius: 12px;
    border: none;
    background: transparent;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .dark .nav-item {
    color: #6b7280;
  }

  .light .nav-item {
    color: #9ca3af;
  }

  .dark .nav-item:hover {
    background: rgba(255, 255, 255, 0.05);
    color: #d1d5db;
  }

  .light .nav-item:hover {
    background: rgba(0, 0, 0, 0.05);
    color: #4b5563;
  }

  .dark .nav-item.active {
    background: rgba(45, 212, 191, 0.1);
    color: #2dd4bf;
  }

  .light .nav-item.active {
    background: rgba(45, 212, 191, 0.1);
    color: #0d9488;
  }

  .tooltip {
    position: absolute;
    left: 64px;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s;
    z-index: 100;
  }

  .dark .tooltip {
    background: #1f2937;
    color: #e5e7eb;
  }

  .light .tooltip {
    background: white;
    color: #1f2937;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    border: 1px solid #f3f4f6;
  }

  .nav-item:hover .tooltip {
    opacity: 1;
  }

  .bottom {
    margin-top: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }

  .icon-btn {
    padding: 10px;
    border-radius: 12px;
    border: none;
    background: transparent;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .dark .icon-btn {
    color: #6b7280;
  }

  .light .icon-btn {
    color: #9ca3af;
  }

  .dark .icon-btn:hover {
    background: rgba(255, 255, 255, 0.05);
    color: #fbbf24;
  }

  .light .icon-btn:hover {
    background: rgba(0, 0, 0, 0.05);
    color: #f97316;
  }
</style>
