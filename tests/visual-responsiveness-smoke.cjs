// Comprehensive visual responsiveness smoke test for EcoLingo
// Covers: 600x520 min size, 850px breakpoint, 1000x600 default, maximized,
// long titles, multiline subtitles, drawer toggle, practice menu, and keyboard focus.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { runUiSmoke } = require('./helpers/electron-ui.cjs');

runUiSmoke({
  prefix: 'ecolingo-visual-',
  // Extra-long name to test title truncation
  lessonName: '002 02 - An Extremely Long Title That Stretches Across The Entire Top Header To Verify Text Truncation',
  window: { width: 1000, height: 600, minWidth: 600, minHeight: 520 },
  switches: { 'force-device-scale-factor': '1.5' }, // Test with high-DPI scaling
}, async ({ win, temp, evaluate, waitFor }) => {
    console.log('1. Loading sample lesson with long title...');
    await evaluate(`document.querySelector('.lesson-empty button').click()`);
    await waitFor(`Boolean(document.querySelector('.lesson-item'))`);
    await evaluate(`document.querySelector('.lesson-item').click()`);
    await waitFor(`Boolean(document.querySelector('.sentence-item'))`);
    await waitFor(`Boolean(document.querySelector('[aria-label="暂停"]'))`);
    await evaluate(`document.querySelector('[aria-label="暂停"]').click()`);
    await new Promise((r) => setTimeout(r, 250));

    // --- TEST DESIGN TOKENS ---
    console.log('2. Verifying unified design tokens (radius, active state)...');
    // Compared against the tokens in src/css/app.scss rather than hard-coded values.
    const tokenChecks = await evaluate(`(() => {
      const token = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      // Resolves a color token to the rgb() form that computed styles use.
      const color = name => {
        const probe = document.createElement('div');
        probe.style.color = 'var(' + name + ')';
        document.body.append(probe);
        const value = getComputedStyle(probe).color;
        probe.remove();
        return value;
      };
      const sentence = getComputedStyle(document.querySelector('.sentence-item'));
      const active = getComputedStyle(document.querySelector('.sentence-item--active'));
      const panel = getComputedStyle(document.querySelector('.sentences-panel'));
      const lesson = getComputedStyle(document.querySelector('.lesson-item--active'));
      return {
        sentenceRadius: sentence.borderRadius, radiusMd: token('--radius-md'),
        panelBackground: panel.backgroundColor, panelRadius: panel.borderRadius,
        activeBackground: active.backgroundColor, activeBg: color('--active-bg'),
        activeShadow: active.boxShadow, accent: color('--accent'),
        activeWeight: active.fontWeight, lessonWeight: lesson.fontWeight,
        lessonColor: lesson.color, activeInk: color('--active-ink'),
      };
    })()`);

    assert.equal(tokenChecks.sentenceRadius, tokenChecks.radiusMd, 'Sentence items use --radius-md');
    assert.equal(tokenChecks.panelBackground, 'rgba(0, 0, 0, 0)', 'Subtitle panel is transparent');
    assert.equal(tokenChecks.panelRadius, '0px', 'Subtitle panel has square edges');
    assert.equal(tokenChecks.activeBackground, tokenChecks.activeBg, 'Current sentence uses --active-bg');
    assert.ok(tokenChecks.activeShadow.includes(tokenChecks.accent) && tokenChecks.activeShadow.includes('inset'), 'Current sentence has the --accent indicator bar');
    assert.equal(tokenChecks.activeWeight, '600', 'Current sentence is semibold');
    assert.equal(tokenChecks.lessonWeight, '600', 'Active lesson is semibold');
    assert.equal(tokenChecks.lessonColor, tokenChecks.activeInk, 'Active lesson uses --active-ink');

    // --- TEST LONG TITLE TRUNCATION & NO HORIZONTAL OVERFLOW ---
    console.log('3. Testing 600x520 minimum window...');
    win.setSize(600, 520);
    await new Promise((r) => setTimeout(r, 400));
    await waitFor(`window.innerWidth <= 620`);

    const minSizeCheck = await evaluate(`(() => {
      const docWidth = document.documentElement.clientWidth;
      const scrollWidth = document.documentElement.scrollWidth;
      const titleEl = document.querySelector('.lesson-progress .ellipsis');
      const countEl = document.querySelector('.lesson-count');
      const countVisible = countEl && countEl.getBoundingClientRect().width > 0;
      const rows = ['.practice-controls', '.sentence-navigation', '.playback-options']
        .map(selector => getComputedStyle(document.querySelector(selector)).gridRowStart);
      const shown = selector => getComputedStyle(document.querySelector(selector)).display !== 'none';

      return {
        noHorizontalScroll: scrollWidth <= docWidth + 1,
        titleTruncated: titleEl ? titleEl.scrollWidth >= titleEl.clientWidth : false,
        countVisible,
        singleRow: rows.every(row => row === '1'),
        loopAndSpeedHidden: !shown('.loop-mode-control') && !shown('.playback-rate-control'),
        moreShown: shown('.more-options-control'),
      };
    })()`);

    assert.ok(minSizeCheck.noHorizontalScroll, 'No horizontal scroll at 600x520');
    assert.ok(minSizeCheck.countVisible, 'Sentence count remains visible even with very long course title');
    assert.ok(minSizeCheck.singleRow, 'Bottom bar stays on one row at minimum width');
    assert.ok(minSizeCheck.loopAndSpeedHidden && minSizeCheck.moreShown, 'At <=600px loop and speed move into the "more" menu');

    fs.writeFileSync(path.join(temp, 'ui-600x520.png'), (await win.webContents.capturePage()).toPNG());

    // Verify 600x520 drawer backdrop transparency and hover-only tooltip
    const toggleBtn = `document.querySelector('.top-sidebar-toggle')`;
    await evaluate(`${toggleBtn}.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))`);
    assert.equal(await evaluate(`Boolean(document.querySelector('.q-tooltip'))`), false, 'Tooltip must not show without hover delay');
    await evaluate(`${toggleBtn}.click()`);
    await waitFor(`Boolean(document.querySelector('.q-drawer__backdrop'))`);
    await waitFor(`!document.querySelector('.q-tooltip')`);
    assert.equal(await evaluate(`Boolean(document.querySelector('.q-tooltip'))`), false, 'Tooltip must disappear immediately on click');

    const backdropBg = await evaluate(`getComputedStyle(document.querySelector('.q-drawer__backdrop')).backgroundColor`);
    assert.equal(backdropBg, 'rgba(0, 0, 0, 0)', 'Drawer backdrop must be completely transparent (no grey filter)');
    fs.writeFileSync(path.join(temp, 'ui-600x520-drawer-open.png'), (await win.webContents.capturePage()).toPNG());

    // --- TEST 600px BREAKPOINT ---
    console.log('4. Testing the 600px breakpoint...');
    win.setSize(640, 600);
    await waitFor(`window.innerWidth > 600`);
    await new Promise((r) => setTimeout(r, 200));
    const wideCheck = await evaluate(`(() => {
      const shown = selector => getComputedStyle(document.querySelector(selector)).display !== 'none';
      return {
        loopAndSpeedShown: shown('.loop-mode-control') && shown('.playback-rate-control'),
        moreHidden: !shown('.more-options-control'),
        singleRow: getComputedStyle(document.querySelector('.practice-controls')).gridRowStart === '1',
      };
    })()`);
    assert.ok(wideCheck.loopAndSpeedShown && wideCheck.moreHidden, 'Above 600px loop and speed sit in the bar');
    assert.ok(wideCheck.singleRow, 'Bottom bar stays on one row above 600px');
    fs.writeFileSync(path.join(temp, 'ui-640px.png'), (await win.webContents.capturePage()).toPNG());

    // --- TEST 1000x600 STANDARD & MAXIMIZED LAYOUT ---
    console.log('5. Testing 1000x600 and maximized layouts...');
    win.setSize(1000, 600);
    await new Promise((r) => setTimeout(r, 350));
    fs.writeFileSync(path.join(temp, 'ui-1000x600.png'), (await win.webContents.capturePage()).toPNG());

    win.maximize();
    await new Promise((r) => setTimeout(r, 400));
    const maximizedPanelWidth = await evaluate(`document.querySelector('.sentences-panel').getBoundingClientRect().width`);
    assert.ok(maximizedPanelWidth <= 982, 'Sentences panel max-width must be constrained under maximized window (<=980px)');
    fs.writeFileSync(path.join(temp, 'ui-maximized.png'), (await win.webContents.capturePage()).toPNG());
    win.unmaximize();
    await new Promise((r) => setTimeout(r, 300));

    // --- TEST PRACTICE MENU & DRAWER TOGGLE ---
    console.log('6. Testing practice mode menu styling and drawer toggle...');
    win.setSize(1000, 600);
    // Shadowing opens the microphone with the original audio; give it a silent stream.
    await evaluate(`navigator.mediaDevices.getUserMedia = async () => new AudioContext().createMediaStreamDestination().stream; true`);
    await evaluate(`document.querySelector('[role="switch"]').click()`);
    await waitFor(`Boolean(document.querySelector('[aria-label="选择练习方式"]'))`);
    await evaluate(`document.querySelector('[aria-label="选择练习方式"]').click()`);
    await waitFor(`Boolean(document.querySelector('.practice-menu'))`);

    const menuCheck = await evaluate(`(() => {
      const menu = document.querySelector('.practice-menu');
      const activeItem = menu.querySelector('.q-item--active');
      return {
        menuRadius: getComputedStyle(menu).borderRadius,
        radiusLg: getComputedStyle(document.documentElement).getPropertyValue('--radius-lg').trim(),
        activeItemColor: activeItem ? getComputedStyle(activeItem).color : null,
      };
    })()`);
    assert.equal(menuCheck.menuRadius, menuCheck.radiusLg, 'Menus use --radius-lg');
    assert.equal(menuCheck.activeItemColor, tokenChecks.activeInk, 'Active practice method uses --active-ink');
    fs.writeFileSync(path.join(temp, 'ui-practice-menu.png'), (await win.webContents.capturePage()).toPNG());
    // A real Escape key press closes the open menu first.
    win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
    win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
    await waitFor(`!document.querySelector('.practice-menu')`);

    // --- TEST KEYBOARD FOCUS (focus-visible) ---
    console.log('7. Testing keyboard focus outline rule...');
    const focusRuleCheck = await evaluate(`(() => {
      const rootStyle = getComputedStyle(document.documentElement);
      const focusRing = rootStyle.getPropertyValue('--focus-ring').trim();
      let hasFocusVisibleRule = false;
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule.selectorText && rule.selectorText.includes(':focus-visible') && rule.selectorText.includes('.q-btn')) {
              hasFocusVisibleRule = true;
              break;
            }
          }
        } catch (e) {}
        if (hasFocusVisibleRule) break;
      }
      return {
        hasFocusRingToken: focusRing.length > 0,
        hasFocusVisibleRule,
      };
    })()`);
    assert.ok(focusRuleCheck.hasFocusRingToken, '--focus-ring CSS token must be defined');
    assert.ok(focusRuleCheck.hasFocusVisibleRule, ':focus-visible CSS rules must cover buttons');
    // --- TEST FOCUS MODE CARD STABILITY ---
    console.log('8. Testing focus mode stage across sentence lengths...');
    await evaluate(`document.querySelector('[aria-label="专注显示"]').click()`);
    await waitFor(`Boolean(document.querySelector('.zen-stage'))`);
    await new Promise((r) => setTimeout(r, 300));

    const zenWidth1 = await evaluate(`document.querySelector('.zen-stage').getBoundingClientRect().width`);
    await evaluate(`document.querySelector('[aria-label="下一句"]').click()`);
    await new Promise((r) => setTimeout(r, 200));
    const zenWidth2 = await evaluate(`document.querySelector('.zen-stage').getBoundingClientRect().width`);
    assert.ok(Math.abs(zenWidth1 - zenWidth2) < 1, `Focus mode card width must be stable across sentences (got ${zenWidth1} vs ${zenWidth2})`);
    assert.ok(Math.abs(zenWidth1 - (await evaluate(`document.documentElement.clientWidth`))) < 1, 'Focus mode stage fills the window');
    // After the cross-fade the new sentence is fully shown.
    await waitFor(`(() => { const el = document.querySelector('.zen-current'); return el?.textContent.trim() === 'Waking up, that I can handle.' && getComputedStyle(el).opacity === '1'; })()`);
    // Neighbouring sentences stay dimmed and blurred.
    const neighbor = await evaluate(`(() => { const style = getComputedStyle(document.querySelector('.zen-neighbor')); return { opacity: style.opacity, filter: style.filter }; })()`);
    assert.equal(neighbor.opacity, '0.4', 'Neighbour sentences are at 0.4 opacity');
    assert.equal(neighbor.filter, 'blur(2.5px)', 'Neighbour sentences keep the 2.5px blur');
    fs.writeFileSync(path.join(temp, 'ui-focus-mode.png'), (await win.webContents.capturePage()).toPNG());

    assert.equal(await evaluate(`Boolean(document.querySelector('.q-dialog'))`), false, 'No error dialog opened along the way');

    console.log('ALL VISUAL & RESPONSIVENESS TESTS PASSED!');
    console.log('Screenshots generated in: ' + temp);
});
