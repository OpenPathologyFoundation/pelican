<script lang="ts">
  /**
   * ReauthPrompt Component
   *
   * Modal prompt for re-authentication when JWT expires
   * Per SRS-001 SYS-ERR-003
   */

  /** Props */
  interface Props {
    username?: string;
    reason?: 'expired' | 'revoked' | 'invalid';
    returnUrl?: string;
    onreauth?: () => void;
    onlogout?: () => void;
  }

  let {
    username,
    reason = 'expired',
    returnUrl,
    onreauth,
    onlogout,
  }: Props = $props();

  /** Get reason message */
  function getReasonMessage(r: typeof reason): string {
    switch (r) {
      case 'expired':
        return 'Your session has expired due to inactivity.';
      case 'revoked':
        return 'Your session was ended by an administrator.';
      case 'invalid':
        return 'Your authentication token is invalid.';
      default:
        return 'You need to sign in again.';
    }
  }

  let reasonMessage = $derived(getReasonMessage(reason));
</script>

<div class="reauth-prompt" role="dialog" aria-modal="true" aria-labelledby="reauth-title">
  <div class="reauth-prompt__backdrop"></div>

  <div class="reauth-prompt__dialog">
    <div class="reauth-prompt__header">
      <div class="reauth-prompt__icon">🔒</div>
      <h2 id="reauth-title" class="reauth-prompt__title">Session Expired</h2>
    </div>

    <div class="reauth-prompt__body">
      <p class="reauth-prompt__message">{reasonMessage}</p>

      {#if username}
        <div class="reauth-prompt__user">
          <span class="user-label">Signed in as:</span>
          <span class="user-name">{username}</span>
        </div>
      {/if}

      <div class="reauth-prompt__info">
        <p>
          Your unsaved work on this case is preserved locally.
          Sign in again to continue where you left off.
        </p>
      </div>
    </div>

    <div class="reauth-prompt__actions">
      <button
        class="reauth-btn reauth-btn--primary"
        onclick={() => onreauth?.()}
      >
        Sign In
      </button>
      <button class="reauth-btn reauth-btn--secondary" onclick={() => onlogout?.()}>
        Sign Out
      </button>
    </div>

    <div class="reauth-prompt__footer">
      <small>
        If you continue to have trouble signing in, please contact IT support.
      </small>
    </div>
  </div>
</div>

<style>
  .reauth-prompt {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
  }

  .reauth-prompt__backdrop {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(8px);
  }

  .reauth-prompt__dialog {
    position: relative;
    width: 100%;
    max-width: 400px;
    margin: 16px;
    background-color: #1f2937;
    border-radius: 12px;
    border: 1px solid #374151;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    overflow: hidden;
  }

  .reauth-prompt__header {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 32px 24px 16px;
    background: linear-gradient(135deg, #1e3a5f 0%, #1f2937 100%);
    border-bottom: 1px solid #374151;
  }

  .reauth-prompt__icon {
    font-size: 48px;
    margin-bottom: 12px;
  }

  .reauth-prompt__title {
    margin: 0;
    font-size: 24px;
    font-weight: 600;
    color: #f9fafb;
  }

  .reauth-prompt__body {
    padding: 24px;
  }

  .reauth-prompt__message {
    margin: 0 0 16px 0;
    font-size: 14px;
    color: #d1d5db;
    text-align: center;
  }

  .reauth-prompt__user {
    display: flex;
    justify-content: center;
    gap: 8px;
    padding: 12px;
    margin-bottom: 16px;
    background-color: rgba(0, 0, 0, 0.2);
    border-radius: 6px;
    font-size: 13px;
  }

  .user-label {
    color: #6b7280;
  }

  .user-name {
    color: #f9fafb;
    font-weight: 500;
  }

  .reauth-prompt__info {
    padding: 12px;
    background-color: rgba(59, 130, 246, 0.1);
    border-left: 3px solid #3b82f6;
    border-radius: 4px;
  }

  .reauth-prompt__info p {
    margin: 0;
    font-size: 12px;
    color: #93c5fd;
    line-height: 1.5;
  }

  .reauth-prompt__actions {
    display: flex;
    gap: 12px;
    padding: 0 24px 24px;
  }

  .reauth-btn {
    flex: 1;
    padding: 12px 24px;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.15s ease, transform 0.1s ease;
  }

  .reauth-btn:active {
    transform: scale(0.98);
  }

  .reauth-btn--primary {
    background-color: #3b82f6;
    color: #fff;
  }

  .reauth-btn--primary:hover {
    background-color: #2563eb;
  }

  .reauth-btn--primary:focus {
    outline: 2px solid #60a5fa;
    outline-offset: 2px;
  }

  .reauth-btn--secondary {
    background-color: rgba(255, 255, 255, 0.1);
    color: #d1d5db;
  }

  .reauth-btn--secondary:hover {
    background-color: rgba(255, 255, 255, 0.15);
  }

  .reauth-prompt__footer {
    padding: 12px 24px;
    background-color: rgba(0, 0, 0, 0.2);
    text-align: center;
  }

  .reauth-prompt__footer small {
    color: #6b7280;
    font-size: 11px;
  }
</style>
