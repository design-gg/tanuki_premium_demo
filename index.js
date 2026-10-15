/* Premium Bar: single state controller, safe for embedding in an iframe.
   Parent sends { type: 'premiumbar-expand' | 'premiumbar-collapse' }.
   It can also send {type:'premiumbar-set-mode', mode:'host'} to disable demo timer.
   Demo timer auto-collapses at 3 seconds unless host mode is activated.
   Parent is responsible for scroll direction/distance; iframe does NOT
   monitor the host document's scroll. */
(function () {
    'use strict';
    const banner = document.querySelector('.PremiumBarGG');
    if (!banner) return;
    const video = banner.querySelector('video');
    const mute = banner.querySelector('.PremiumBarGG-mute');
    let hostControlled = false;
    let demoTimer = null;
    let state = 'expanded';
    let initialized = false;
    let desiredState = 'expanded';
    let pointerInside = false;

    function announce() {
        try {
            parent.postMessage({type:'premiumbar-state', state:state}, '*');
        } catch (_) {}
    }
    function setState(next, source) {
        if (next !== 'expanded' && next !== 'collapsed') return;
        if (source === 'host') {
            hostControlled = true;
            clearTimeout(demoTimer);
            desiredState = next;
        }
        if (state === next && initialized) return;
        state = next;
        initialized = true;
        banner.classList.toggle('is-expanded', next === 'expanded');
        banner.classList.toggle('PremiumBarGG-expand', next === 'expanded');
        banner.classList.toggle('PremiumBarGG-expanded', next === 'expanded');
        announce();
    }
    // Native video sound control. Do not trigger the clickable banner.
    if (mute && video) {
        mute.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
            video.muted = !video.muted;
            mute.classList.toggle('mute-on', !video.muted);
            mute.setAttribute('aria-pressed', String(!video.muted));
            mute.setAttribute('aria-label', video.muted ? 'Включить звук' : 'Выключить звук');
        });
    }
    window.addEventListener('message', (event) => {
        const data = event.data;
        if (!data || typeof data !== 'object') return;
        // In production, restrict allowed origins to the publisher's domain.
        if (data.type === 'premiumbar-set-mode' && data.mode === 'host') {
            hostControlled = true;
            clearTimeout(demoTimer);
        }
        if (data.type === 'premiumbar-expand') setState('expanded', 'host');
        if (data.type === 'premiumbar-collapse') {
            if (pointerInside && window.matchMedia('(min-width:600px)').matches) {
                hostControlled = true;
                clearTimeout(demoTimer);
                desiredState = 'collapsed';
            } else setState('collapsed', 'host');
        }
        if (data.type === 'set-click-url') {
            const link = document.getElementById('click-url');
            if (!link || typeof data.url !== 'string') return;
            try {
                const target = new URL(data.url, location.href);
                if (!['http:', 'https:'].includes(target.protocol)) return;
                link.href = target.href;
                if (data.target === '_blank' || data.target === '_self') link.target = data.target;
                link.rel = 'noopener noreferrer';
            } catch (_) {}
        }
    });
    // Local preview: expanded immediately; collapse automatically after 3s.
    // Host should send premiumbar-set-mode as soon as its iframe loads.
    setState('expanded', 'init');
    demoTimer = setTimeout(() => {
        if (!hostControlled) setState('collapsed', 'demo');
    }, 3000);
    // Desktop hover remains available even under parent scroll control.
    // Leaving hover restores the host-requested state, without disabling scrolling.
    if (window.matchMedia('(min-width:600px)').matches) {
        banner.addEventListener('mouseenter', () => {
            pointerInside = true;
            setState('expanded', 'hover');
        });
        banner.addEventListener('mouseleave', () => {
            pointerInside = false;
            setState(hostControlled ? desiredState : 'collapsed', 'hover');
        });
    }
    // MOBILE: upward swipe directly ON the banner reopens it after collapsing.
    // A page-wide upward swipe belongs to the parent document and must be
    // translated to premiumbar-expand there; a cross-origin iframe cannot
    // inspect gestures performed outside its own rectangle.
    let touchStart = null;
    banner.addEventListener('touchstart', (event) => {
        if (!window.matchMedia('(max-width:599px)').matches) return;
        if (event.touches.length !== 1) return;
        touchStart = {
            x: event.touches[0].clientX,
            y: event.touches[0].clientY
        };
    }, {passive:true});
    banner.addEventListener('touchend', (event) => {
        if (!touchStart || !window.matchMedia('(max-width:599px)').matches) {
            touchStart = null;
            return;
        }
        const end = event.changedTouches[0];
        const dy = end.clientY - touchStart.y;
        const dx = end.clientX - touchStart.x;
        touchStart = null;
        if (dy < -35 && Math.abs(dy) > Math.abs(dx) * 1.2) {
            // Local gesture does not switch the banner into host-only mode.
            setState('expanded', 'gesture');
        }
    }, {passive:true});
    banner.addEventListener('touchcancel', () => { touchStart = null; }, {passive:true});

    // Simple documented public API, helpful for same-origin demos.
    window.PremiumBarGG = {
        expand: () => setState('expanded', 'host'),
        collapse: () => setState('collapsed', 'host'),
        getState: () => state
    };
})();
