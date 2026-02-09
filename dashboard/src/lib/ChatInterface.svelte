<script>
  import { createEventDispatcher } from 'svelte';
  
  export let theme = 'dark';

  $: isDark = theme === 'dark';

  let inputText = '';
  let showModelDropdown = false;

  const quickActions = [
    { label: 'Search', icon: 'globe' },
    { label: 'Analyze', icon: 'zap' },
    { label: 'Summarize', icon: 'sparkles' },
    { label: 'Code', icon: 'command' }
  ];

  const suggestions = [
    'Write a marketing plan for a tech startup',
    'Explain quantum computing in simple terms',
    'How do I optimize my React application?'
  ];

  const models = [
    { id: 'claude-sonnet', name: 'Claude 3.5 Sonnet' },
    { id: 'claude-opus', name: 'Claude Opus' },
    { id: 'gpt-4o', name: 'GPT-4o' }
  ];

  let currentModel = models[0];

  function selectModel(model) {
    currentModel = model;
    showModelDropdown = false;
  }

  function handleSubmit() {
    if (inputText.trim()) {
      console.log('Send:', inputText);
      inputText = '';
    }
  }

  function handleKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }
</script>

<div class="chat-interface" class:dark={isDark} class:light={!isDark}>
  <!-- Title -->
  <div class="header">
    <h1>EasyHub</h1>
    <p>How can I help you today?</p>
  </div>

  <!-- Input Box -->
  <div class="input-container">
    <div class="input-box">
      <textarea
        bind:value={inputText}
        on:keydown={handleKeydown}
        placeholder="Ask anything. Type @ for tools and / for commands."
        rows="1"
      ></textarea>
      
      <div class="input-footer">
        <div class="input-left">
          <button class="attach-btn" aria-label="Attach file">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
            </svg>
          </button>
          
          <div class="divider"></div>
          
          <!-- Model Selector -->
          <div class="model-selector">
            <button class="model-btn" on:click={() => showModelDropdown = !showModelDropdown}>
              {currentModel.name}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
            
            {#if showModelDropdown}
              <div class="model-dropdown">
                {#each models as model}
                  <button 
                    class="model-option"
                    class:active={currentModel.id === model.id}
                    on:click={() => selectModel(model)}
                  >
                    {model.name}
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        </div>

        <button 
          class="send-btn" 
          class:active={inputText.trim()}
          on:click={handleSubmit}
          disabled={!inputText.trim()}
          aria-label="Send message"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <line x1="12" y1="19" x2="12" y2="5"></line>
            <polyline points="5 12 12 5 19 12"></polyline>
          </svg>
        </button>
      </div>
    </div>
  </div>

  <!-- Quick Actions -->
  <div class="quick-actions">
    {#each quickActions as action}
      <button class="action-chip">
        {#if action.icon === 'globe'}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="2" y1="12" x2="22" y2="12"></line>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
          </svg>
        {:else if action.icon === 'zap'}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
        {:else if action.icon === 'sparkles'}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 3v18M5.5 8.5l13 7M18.5 8.5l-13 7"></path>
          </svg>
        {:else if action.icon === 'command'}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z"></path>
          </svg>
        {/if}
        {action.label}
      </button>
    {/each}
  </div>

  <!-- Recent Explorations -->
  <div class="suggestions">
    <span class="suggestions-label">Recent Explorations</span>
    <div class="suggestions-list">
      {#each suggestions as suggestion}
        <button class="suggestion-item">
          "{suggestion}"
        </button>
      {/each}
    </div>
  </div>
</div>

<style>
  .chat-interface {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    max-width: 720px;
    padding: 0 24px;
  }

  .header {
    text-align: center;
    margin-bottom: 40px;
  }

  .header h1 {
    font-weight: 300;
    font-size: 56px;
    letter-spacing: -0.02em;
    margin: 0 0 8px 0;
  }

  .dark .header h1 {
    color: rgba(255, 255, 255, 0.9);
  }

  .light .header h1 {
    color: rgba(0, 0, 0, 0.8);
  }

  .header p {
    font-size: 18px;
    font-weight: 300;
    margin: 0;
  }

  .dark .header p {
    color: #6b7280;
  }

  .light .header p {
    color: #9ca3af;
  }

  .input-container {
    width: 100%;
    margin-bottom: 40px;
  }

  .input-box {
    padding: 8px;
    border-radius: 28px;
    border: 1px solid;
    transition: all 0.5s;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  }

  .dark .input-box {
    background: rgba(22, 22, 22, 0.8);
    backdrop-filter: blur(24px);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .light .input-box {
    background: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(24px);
    border-color: #e5e7eb;
  }

  .input-box:focus-within {
    border-color: rgba(45, 212, 191, 0.5);
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 4px rgba(45, 212, 191, 0.05);
  }

  textarea {
    width: 100%;
    background: transparent;
    border: none;
    outline: none;
    resize: none;
    min-height: 48px;
    max-height: 240px;
    padding: 12px 16px 8px;
    font-size: 17px;
    font-family: inherit;
    line-height: 1.6;
    overflow-y: auto;
  }

  .dark textarea {
    color: #e5e7eb;
  }

  .light textarea {
    color: #1f2937;
  }

  .dark textarea::placeholder {
    color: #6b7280;
  }

  .light textarea::placeholder {
    color: #9ca3af;
  }

  .input-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 8px 8px;
  }

  .input-left {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .attach-btn {
    padding: 8px;
    border-radius: 50%;
    border: none;
    background: transparent;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .dark .attach-btn {
    color: #6b7280;
  }

  .light .attach-btn {
    color: #9ca3af;
  }

  .dark .attach-btn:hover {
    background: rgba(255, 255, 255, 0.05);
    color: #d1d5db;
  }

  .light .attach-btn:hover {
    background: rgba(0, 0, 0, 0.05);
    color: #4b5563;
  }

  .divider {
    width: 1px;
    height: 16px;
    margin: 0 4px;
  }

  .dark .divider {
    background: rgba(255, 255, 255, 0.1);
  }

  .light .divider {
    background: rgba(0, 0, 0, 0.1);
  }

  .model-selector {
    position: relative;
  }

  .model-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 20px;
    border: 1px solid;
    background: transparent;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .dark .model-btn {
    color: #9ca3af;
    border-color: rgba(255, 255, 255, 0.05);
  }

  .light .model-btn {
    color: #6b7280;
    border-color: #e5e7eb;
  }

  .dark .model-btn:hover {
    border-color: rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.05);
  }

  .light .model-btn:hover {
    background: #f9fafb;
  }

  .model-dropdown {
    position: absolute;
    bottom: 100%;
    left: 0;
    margin-bottom: 8px;
    padding: 8px;
    border-radius: 12px;
    border: 1px solid;
    min-width: 180px;
    z-index: 100;
  }

  .dark .model-dropdown {
    background: #1f2937;
    border-color: rgba(255, 255, 255, 0.1);
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  }

  .light .model-dropdown {
    background: white;
    border-color: #e5e7eb;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  }

  .model-option {
    display: block;
    width: 100%;
    padding: 10px 12px;
    border: none;
    border-radius: 8px;
    background: transparent;
    text-align: left;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .dark .model-option {
    color: #d1d5db;
  }

  .light .model-option {
    color: #374151;
  }

  .dark .model-option:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .light .model-option:hover {
    background: #f3f4f6;
  }

  .model-option.active {
    background: rgba(45, 212, 191, 0.2);
    color: #2dd4bf;
  }

  .send-btn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: none;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .dark .send-btn {
    background: rgba(255, 255, 255, 0.05);
    color: #4b5563;
  }

  .light .send-btn {
    background: rgba(0, 0, 0, 0.05);
    color: #9ca3af;
  }

  .send-btn.active {
    background: #2dd4bf;
    color: black;
    box-shadow: 0 4px 12px rgba(45, 212, 191, 0.4);
  }

  .send-btn.active:hover {
    transform: scale(1.05);
  }

  .send-btn:disabled {
    cursor: not-allowed;
  }

  .quick-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 12px;
    margin-bottom: 48px;
  }

  .action-chip {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 20px;
    border-radius: 16px;
    border: 1px solid;
    background: transparent;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .dark .action-chip {
    border-color: rgba(255, 255, 255, 0.05);
    color: #9ca3af;
    background: rgba(255, 255, 255, 0.02);
  }

  .light .action-chip {
    border-color: #e5e7eb;
    color: #4b5563;
    background: white;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }

  .dark .action-chip:hover {
    border-color: rgba(45, 212, 191, 0.3);
    color: #2dd4bf;
    background: rgba(45, 212, 191, 0.05);
    transform: translateY(-2px);
  }

  .light .action-chip:hover {
    border-color: rgba(45, 212, 191, 0.3);
    color: #0d9488;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
  }

  .suggestions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .suggestions-label {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    font-weight: 500;
  }

  .dark .suggestions-label {
    color: #4b5563;
  }

  .light .suggestions-label {
    color: #9ca3af;
  }

  .suggestions-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
  }

  .suggestion-item {
    text-align: left;
    padding: 8px 16px;
    border: none;
    border-radius: 8px;
    background: transparent;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .dark .suggestion-item {
    color: #6b7280;
  }

  .light .suggestion-item {
    color: #6b7280;
  }

  .dark .suggestion-item:hover {
    background: rgba(255, 255, 255, 0.05);
    color: #d1d5db;
  }

  .light .suggestion-item:hover {
    background: rgba(0, 0, 0, 0.05);
    color: #1f2937;
  }
</style>
