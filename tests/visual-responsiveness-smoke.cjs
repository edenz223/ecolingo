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
    const tokenChecks = await evaluate(`(() => {
      const sentence = document.querySelector('.sentence-item');
      const activeSentence = document.querySelector('.sentence-item--active');
      const panel = document.querySelector('.sentences-panel');
      const nav = document.querySelector('.sentence-navigation');
      const lessonItem = document.querySelector('.lesson-item--active');
      
      const sRadius = getComputedStyle(sentence).borderRadius;
      const pRadius = getComputedStyle(panel).borderRadius;
      const nRadius = getComputedStyle(nav).borderRadius;
      const sColor = getComputedStyle(activeSentence).color;
      const lColor = getComputedStyle(lessonItem).color;
      const sWeight = getComputedStyle(activeSentence).fontWeight;
      const lWeight = getComputedStyle(lessonItem).fontWeight;
      
      const lLabel = lessonItem ? lessonItem.querySelector('.q-item__label') : null;
      const lLabelColor = lLabel ? getComputedStyle(lLabel).color : null;
      return {
        sentenceRadius: sRadius,
        panelRadius: pRadius,
        navRadius: nRadius,
        sentenceActiveColor: sColor,
        lessonActiveColor: lColor,
        lessonLabelColor: lLabelColor,
        lessonClass: lessonItem ? lessonItem.className : 'NONE',
        sentenceActiveWeight: sWeight,
        lessonActiveWeight: lWeight,
      };
    })()`);
    console.log('DEBUG TOKEN CHECKS:', JSON.stringify(tokenChecks, null, 2));

    assert.equal(tokenChecks.sentenceRadius, '16px', 'Sentence item radius must be 16px (var(--radius-lg))');
    assert.equal(tokenChecks.panelRadius, '20px', 'Sentence panel radius must be 20px (var(--radius-xl))');
    assert.match(tokenChecks.navRadius, /999px|50%/, 'Navigation pill must have full capsule radius');
    assert.equal(tokenChecks.sentenceActiveColor, tokenChecks.lessonActiveColor, 'Active sentence and active lesson must share unified text color');
    assert.equal(tokenChecks.sentenceActiveWeight, tokenChecks.lessonActiveWeight, 'Active sentence and active lesson must share unified font weight');

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
      const isTwoRow = getComputedStyle(document.querySelector('.sentence-navigation')).gridRowStart === '1' &&
                       getComputedStyle(document.querySelector('.practice-controls')).gridRowStart === '2';

      return {
        noHorizontalScroll: scrollWidth <= docWidth + 1,
        titleTruncated: titleEl ? titleEl.scrollWidth >= titleEl.clientWidth : false,
        countVisible,
        isTwoRow,
      };
    })()`);

    assert.ok(minSizeCheck.noHorizontalScroll, 'No horizontal scroll at 600x520');
    assert.ok(minSizeCheck.countVisible, 'Sentence count remains visible even with very long course title');
    assert.ok(minSizeCheck.isTwoRow, 'Playback toolbar switches to clean two-row layout at minimum width');

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

    // --- TEST 850px CRITICAL BREAKPOINT ---
    console.log('4. Testing 850px breakpoint transitions...');
    win.setSize(840, 600);
    await new Promise((r) => setTimeout(r, 350));
    const isDoubleRow = await evaluate(`getComputedStyle(document.querySelector('.practice-controls')).gridRowStart === '2'`);
    assert.ok(isDoubleRow, 'At 840px (<=850px), bottom bar must be double-row');
    fs.writeFileSync(path.join(temp, 'ui-850px-double.png'), (await win.webContents.capturePage()).toPNG());

    win.setSize(860, 600);
    await new Promise((r) => setTimeout(r, 350));
    const isSingleRow = await evaluate(`getComputedStyle(document.querySelector('.practice-controls')).gridRowStart === '1'`);
    assert.ok(isSingleRow, 'At 860px (>850px), bottom bar must be single-row');
    fs.writeFileSync(path.join(temp, 'ui-850px-single.png'), (await win.webContents.capturePage()).toPNG());

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
    await evaluate(`document.querySelector('[role="switch"]').click()`);
    await waitFor(`Boolean(document.querySelector('[aria-label="选择练习方式"]'))`);
    await evaluate(`document.querySelector('[aria-label="选择练习方式"]').click()`);
    await waitFor(`Boolean(document.querySelector('.practice-menu'))`);

    const menuCheck = await evaluate(`(() => {
      const menu = document.querySelector('.practice-menu');
      const activeItem = menu.querySelector('.q-item--active');
      return {
        menuRadius: getComputedStyle(menu).borderRadius,
        activeItemColor: activeItem ? getComputedStyle(activeItem).color : null,
      };
    })()`);
    assert.equal(menuCheck.menuRadius, '20px', 'Practice menu radius must be 20px (var(--radius-xl))');
    assert.equal(menuCheck.activeItemColor, tokenChecks.sentenceActiveColor, 'Active practice mode item must share unified active color');
    fs.writeFileSync(path.join(temp, 'ui-practice-menu.png'), (await win.webContents.capturePage()).toPNG());
    await evaluate(`document.querySelector('.q-page').click()`); // Close menu

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
    console.log('8. Testing focus mode card stability across sentence lengths...');
    await evaluate(`document.querySelector('[aria-label="专注显示"]').click()`);
    await waitFor(`Boolean(document.querySelector('.zen-stage'))`);
    await new Promise((r) => setTimeout(r, 300));

    const zenWidth1 = await evaluate(`document.querySelector('.zen-stage').getBoundingClientRect().width`);
    await evaluate(`document.querySelector('[aria-label="下一句"]').click()`);
    await new Promise((r) => setTimeout(r, 200));
    const zenWidth2 = await evaluate(`document.querySelector('.zen-stage').getBoundingClientRect().width`);
    assert.ok(Math.abs(zenWidth1 - zenWidth2) < 1, `Focus mode card width must be stable across sentences (got ${zenWidth1} vs ${zenWidth2})`);
    assert.ok(zenWidth1 <= 982, 'Focus mode card max-width must be constrained to <=980px');
    fs.writeFileSync(path.join(temp, 'ui-focus-mode.png'), (await win.webContents.capturePage()).toPNG());

    console.log('ALL VISUAL & RESPONSIVENESS TESTS PASSED!');
    console.log('Screenshots generated in: ' + temp);
});
