<script lang="ts">
  /**
   * CaseSearch Component - Case Lookup and Selection
   *
   * Provides search by case ID or patient name with
   * typeahead suggestions and worklist quick access.
   */

  import { getApiClient } from '../api-client';
  import type { CaseSummary, WorklistItem } from '../api-client';

  /** Props */
  interface Props {
    /** Callback when a case is selected */
    oncaseselect?: (data: { caseId: string }) => void;
    /** Currently active case ID */
    currentCaseId?: string | null;
    /** Placeholder text */
    placeholder?: string;
  }

  let {
    oncaseselect,
    currentCaseId = null,
    placeholder = 'Search by case ID or patient...',
  }: Props = $props();

  const client = getApiClient();

  /** State */
  let searchQuery = $state('');
  let searchResults = $state<CaseSummary[]>([]);
  let worklist = $state<WorklistItem[]>([]);
  let isSearching = $state(false);
  let showDropdown = $state(false);
  let selectedIndex = $state(-1);
  let inputEl: HTMLInputElement | undefined = $state();

  /** Load worklist on mount */
  $effect(() => {
    loadWorklist();
  });

  /** Load worklist */
  async function loadWorklist(): Promise<void> {
    try {
      worklist = await client.getWorklist();
    } catch (error) {
      console.error('Failed to load worklist:', error);
    }
  }

  /** Search for cases */
  async function search(query: string): Promise<void> {
    if (query.length < 2) {
      searchResults = [];
      return;
    }

    isSearching = true;
    try {
      searchResults = await client.searchCases(query);
    } catch (error) {
      console.error('Search failed:', error);
      searchResults = [];
    } finally {
      isSearching = false;
    }
  }

  /** Handle input change with debounce */
  let searchTimeout: ReturnType<typeof setTimeout> | null = null;
  function handleInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    searchQuery = value;
    selectedIndex = -1;

    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => search(value), 200);
  }

  /** Handle focus */
  function handleFocus(): void {
    showDropdown = true;
  }

  /** Handle blur with delay */
  function handleBlur(): void {
    setTimeout(() => {
      showDropdown = false;
    }, 150);
  }

  /** Handle keyboard navigation */
  function handleKeydown(event: KeyboardEvent): void {
    const items = displayItems;
    if (!items.length) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, -1);
        break;
      case 'Enter':
        event.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < items.length) {
          selectCase(items[selectedIndex].caseId);
        }
        break;
      case 'Escape':
        showDropdown = false;
        inputEl?.blur();
        break;
    }
  }

  /** Select a case */
  function selectCase(caseId: string): void {
    searchQuery = '';
    searchResults = [];
    showDropdown = false;
    selectedIndex = -1;
    oncaseselect?.({ caseId });
  }

  /** Computed: items to display in dropdown */
  let displayItems = $derived(
    searchQuery.length >= 2 ? searchResults : worklist.slice(0, 10)
  );

  /** Get priority badge class */
  function getPriorityClass(priority: string): string {
    switch (priority) {
      case 'stat':
        return 'priority-stat';
      case 'rush':
        return 'priority-rush';
      default:
        return '';
    }
  }
</script>

<div class="case-search">
  <div class="case-search__input-wrapper">
    <span class="case-search__icon">🔍</span>
    <input
      type="text"
      class="case-search__input"
      bind:this={inputEl}
      value={searchQuery}
      oninput={handleInput}
      onfocus={handleFocus}
      onblur={handleBlur}
      onkeydown={handleKeydown}
      {placeholder}
      autocomplete="off"
      spellcheck="false"
    />
    {#if isSearching}
      <span class="case-search__spinner"></span>
    {/if}
  </div>

  {#if showDropdown && displayItems.length > 0}
    <div class="case-search__dropdown">
      {#if searchQuery.length < 2}
        <div class="case-search__section-header">Worklist</div>
      {/if}

      {#each displayItems as item, index}
        <button
          class="case-search__item"
          class:selected={index === selectedIndex}
          class:current={item.caseId === currentCaseId}
          onmousedown={() => selectCase(item.caseId)}
        >
          <div class="case-search__item-main">
            <span class="case-search__item-id">{item.caseId}</span>
            {#if item.priority !== 'routine'}
              <span class="case-search__priority {getPriorityClass(item.priority)}">
                {item.priority.toUpperCase()}
              </span>
            {/if}
          </div>
          <div class="case-search__item-patient">{item.patientName}</div>
          <div class="case-search__item-details">
            <span>{item.diagnosis || item.specimenType}</span>
            <span class="case-search__item-slides">{item.slideCount} slides</span>
          </div>
          {#if item.caseId === currentCaseId}
            <span class="case-search__current-badge">Current</span>
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .case-search {
    position: relative;
    width: 100%;
  }

  .case-search__input-wrapper {
    display: flex;
    align-items: center;
    background: #16213e;
    border: 1px solid #333;
    border-radius: 6px;
    padding: 0 12px;
  }

  .case-search__input-wrapper:focus-within {
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
  }

  .case-search__icon {
    font-size: 1rem;
    margin-right: 8px;
    opacity: 0.6;
  }

  .case-search__input {
    flex: 1;
    background: transparent;
    border: none;
    padding: 12px 0;
    color: #fff;
    font-size: 0.9rem;
    outline: none;
  }

  .case-search__input::placeholder {
    color: #666;
  }

  .case-search__spinner {
    width: 16px;
    height: 16px;
    border: 2px solid #333;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .case-search__dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 4px;
    background: #1a1a2e;
    border: 1px solid #333;
    border-radius: 6px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    max-height: 400px;
    overflow-y: auto;
    z-index: 100;
  }

  .case-search__section-header {
    padding: 8px 12px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    color: #666;
    border-bottom: 1px solid #333;
  }

  .case-search__item {
    display: block;
    width: 100%;
    padding: 12px;
    background: transparent;
    border: none;
    border-bottom: 1px solid #333;
    cursor: pointer;
    text-align: left;
    color: #fff;
    position: relative;
    transition: background 100ms;
  }

  .case-search__item:last-child {
    border-bottom: none;
  }

  .case-search__item:hover,
  .case-search__item.selected {
    background: rgba(59, 130, 246, 0.1);
  }

  .case-search__item.current {
    background: rgba(34, 197, 94, 0.1);
  }

  .case-search__item-main {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }

  .case-search__item-id {
    font-weight: 600;
    font-size: 0.95rem;
  }

  .case-search__priority {
    font-size: 0.65rem;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 3px;
    background: #4b5563;
  }

  .case-search__priority.priority-stat {
    background: #ef4444;
    color: #fff;
  }

  .case-search__priority.priority-rush {
    background: #f59e0b;
    color: #000;
  }

  .case-search__item-patient {
    font-size: 0.85rem;
    color: #ccc;
    margin-bottom: 2px;
  }

  .case-search__item-details {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.75rem;
    color: #888;
  }

  .case-search__item-slides {
    color: #90caf9;
  }

  .case-search__current-badge {
    position: absolute;
    top: 8px;
    right: 8px;
    font-size: 0.65rem;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 3px;
    background: #22c55e;
    color: #fff;
  }
</style>
