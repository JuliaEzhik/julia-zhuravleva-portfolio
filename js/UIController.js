import { CONFIG, TITLE_FIRST, TITLE_LAST, SUBTITLE_TEXT } from './config.js';

/**
 * DOM overlay: replay control and title reveal after cascade completes.
 */
export class UIController {
  /**
   * @param {object} els
   * @param {HTMLElement} els.reveal
   * @param {HTMLElement} els.title
   * @param {HTMLElement} els.subtitle
   * @param {HTMLButtonElement} els.replayBtn
   */
  constructor(els) {
    this.reveal = els.reveal;
    this.title = els.title;
    this.subtitle = els.subtitle;
    this.replayBtn = els.replayBtn;

    this.subtitle.textContent = SUBTITLE_TEXT;
    this.title.replaceChildren();
    const first = document.createElement('span');
    first.className = 'title-reveal__first';
    first.textContent = TITLE_FIRST;
    const last = document.createElement('span');
    last.className = 'title-reveal__last';
    last.textContent = TITLE_LAST;
    this.title.append(first, last);

    this.replayBtn.addEventListener('click', () => {
      if (this._onReplay) this._onReplay();
    });
  }

  /** @param {() => void} fn */
  onReplay(fn) {
    this._onReplay = fn;
  }

  hideReveal() {
    this.reveal.classList.remove('is-visible');
    this.reveal.setAttribute('aria-hidden', 'true');
  }

  showReveal(immediate = false) {
    if (immediate) {
      this.reveal.classList.add('is-visible', 'is-immediate');
    } else {
      const delayMs = CONFIG.timing.titleRevealDelay * 1000;
      window.setTimeout(() => {
        this.reveal.classList.add('is-visible');
        this.reveal.classList.remove('is-immediate');
      }, delayMs);
    }
    this.reveal.setAttribute('aria-hidden', 'false');
  }

  setReplayVisible(visible) {
    this.replayBtn.hidden = !visible;
  }

  /** @param {string} text */
  setSubtitle(text) {
    this.subtitle.textContent = text;
  }
}
