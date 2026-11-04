(function () {
  const DESK_NAV_ITEMS = [
    {
      label: 'Construction',
      slug: 'construction-equipment',
      href: '/category/construction-equipment',
      subCategories: [
        { label: 'Backhoe Loaders', slug: 'backhoe-loaders', href: '/category/backhoe-loaders' },
        { label: 'Excavators', slug: 'excavators', href: '/category/excavators' },
        { label: 'Wheel Loaders', slug: 'wheel-loaders', href: '/category/wheel-loaders' },
        { label: 'Bulldozers', slug: 'bulldozers', href: '/category/bulldozers' },
        { label: 'Cranes', slug: 'cranes', href: '/category/cranes' },
        { label: 'Graders', slug: 'graders', href: '/category/graders' },
        { label: 'Telehandlers', slug: 'telehandlers', href: '/category/telehandlers' },
        { label: 'Roadbuilding', slug: 'roadbuilding', href: '/category/roadbuilding' },
        { label: 'Mining Equipment', slug: 'mining-equipment', href: '/category/mining-equipment' },
        { label: 'Compact Equipment', slug: 'compact-equipment', href: '/category/compact-equipment' },
        { label: 'Attachments', slug: 'attachments', href: '/category/attachments' },
        { label: 'New Launches', slug: 'new-launches', href: '/category/new-launches' }
      ]
    },
    {
      label: 'Agriculture',
      slug: 'agricultural-machinery',
      href: '/category/agricultural-machinery',
      subCategories: [
        { label: 'Tractors', slug: 'tractors', href: '/category/tractors' }
      ]
    },
    {
      label: 'Commercial Vehicles',
      slug: 'commercial-vehicles',
      href: '/category/commercial-vehicles',
      subCategories: [
        { label: 'Heavy Trucks', slug: 'heavy-trucks', href: '/category/heavy-trucks' },
        { label: 'Pickups', slug: 'pickups', href: '/category/pickups' },
        { label: 'Vans', slug: 'vans', href: '/category/vans' },
        { label: 'Buses', slug: 'buses', href: '/category/buses' },
        { label: 'Electric Commercial Vehicles', slug: 'electric-commercial-vehicles', href: '/category/electric-commercial-vehicles' }
      ]
    },
    {
      label: 'Technology',
      slug: 'technology',
      href: '/category/technology',
      subCategories: []
    },
    {
      label: 'Industry News',
      slug: 'industry-news',
      href: '/category/industry-news',
      subCategories: [
        { label: 'Market Updates', slug: 'market-updates', href: '/category/market-updates' },
        { label: 'Projects & Infrastructure', slug: 'projects', href: '/category/projects' }
      ]
    },
    {
      label: 'Reviews',
      slug: 'reviews-comparisons',
      href: '/category/reviews-comparisons',
      subCategories: [
        { label: 'Buying Guides', slug: 'buying-guides', href: '/category/buying-guides' }
      ]
    },
    {
      label: 'Events',
      slug: 'events-exhibitions',
      href: '/category/events-exhibitions',
      subCategories: [
        { label: 'Videos & Walkarounds', slug: 'videos', href: '/category/videos' }
      ]
    },
    {
      label: 'Brands',
      slug: 'bull-machines',
      href: '/manufacturers',
      subCategories: [
        { label: 'All OEM Profiles', slug: 'manufacturers', href: '/manufacturers' },
        { label: 'Equipment Models', slug: 'models', href: '/models' },
        { label: 'Bull Machines Desk', slug: 'bull-machines', href: '/category/bull-machines' },
        { label: 'Caterpillar', slug: 'caterpillar', href: '/manufacturers/caterpillar' },
        { label: 'Komatsu', slug: 'komatsu', href: '/manufacturers/komatsu' },
        { label: 'JCB', slug: 'jcb', href: '/manufacturers/jcb' },
        { label: 'Volvo CE', slug: 'volvo-construction-equipment', href: '/manufacturers/volvo-construction-equipment' }
      ]
    }
  ];

  const REGION_ITEMS = [
    { label: 'India & South Asia', href: '/india/' },
    { label: 'North America', href: '/north-america/' },
    { label: 'Europe', href: '/europe/' },
    { label: 'China', href: '/china/' },
    { label: 'Japan & South Korea', href: '/japan-south-korea/' },
    { label: 'Middle East', href: '/middle-east/' },
    { label: 'Southeast Asia', href: '/southeast-asia/' },
    { label: 'Australia', href: '/australia/' },
    { label: 'Latin America', href: '/latin-america/' },
    { label: 'Africa', href: '/africa/' }
  ];

  function isCurrentPath(href, subCategories) {
    const pathname = (window.location.pathname || '/').replace(/\/+$/, '') || '/';
    const cleanHref = String(href || '').replace(/\/+$/, '') || '/';
    if (pathname === cleanHref) return true;
    if (Array.isArray(subCategories)) {
      return subCategories.some(sub => {
        const subHref = String(sub.href || '').replace(/\/+$/, '');
        return subHref && pathname === subHref;
      });
    }
    return false;
  }

  function isRegionCurrent() {
    const pathname = (window.location.pathname || '/').toLowerCase();
    if (pathname.startsWith('/region')) return true;
    return REGION_ITEMS.some(r => pathname.startsWith(r.href.toLowerCase().replace(/\/+$/, '')));
  }

  function buildHeaderHtml() {
    const pathname = (window.location.pathname || '/').replace(/\/+$/, '') || '/';
    const navItemsHtml = DESK_NAV_ITEMS.map(item => {
      const active = isCurrentPath(item.href, item.subCategories);
      const ariaCurrent = active ? ' aria-current="page"' : '';
      const activeClass = active ? ' active' : '';
      if (!item.subCategories || item.subCategories.length === 0) {
        return `<div class="nav-item"><a class="nav-link${activeClass}" href="${item.href}"${ariaCurrent}>${item.label}</a></div>`;
      }
      const subLinks = item.subCategories.map(sub => {
        const subActive = pathname === sub.href.replace(/\/+$/, '');
        return `<a class="nav-dropdown-link${subActive ? ' active' : ''}" href="${sub.href}"${subActive ? ' aria-current="page"' : ''}>${sub.label}</a>`;
      }).join('');
      return `
        <div class="nav-item has-dropdown">
          <div class="nav-item-row">
            <a class="nav-link${activeClass}" href="${item.href}"${ariaCurrent}>${item.label}</a>
            <button type="button" class="nav-dropdown-toggle" aria-expanded="false" aria-label="${item.label} sub-categories">▾</button>
          </div>
          <div class="nav-dropdown" role="menu" aria-label="${item.label} sub-categories">
            <a class="nav-dropdown-link nav-dropdown-all" href="${item.href}">All ${item.label} →</a>
            ${subLinks}
          </div>
        </div>
      `;
    }).join('');

    const regionActive = isRegionCurrent();
    const regionSubLinks = REGION_ITEMS.map(r => {
      const rActive = (window.location.pathname || '').toLowerCase().startsWith(r.href.toLowerCase().replace(/\/+$/, ''));
      return `<a class="nav-dropdown-link${rActive ? ' active' : ''}" href="${r.href}"${rActive ? ' aria-current="page"' : ''}>${r.label}</a>`;
    }).join('');

    const regionHtml = `
      <div class="nav-item has-dropdown">
        <div class="nav-item-row">
          <a class="nav-link${regionActive ? ' active' : ''}" href="/india/"${regionActive ? ' aria-current="page"' : ''}>Regions</a>
          <button type="button" class="nav-dropdown-toggle" aria-expanded="false" aria-label="Regions sub-menu">▾</button>
        </div>
        <div class="nav-dropdown" role="menu" aria-label="Regional desks">
          ${regionSubLinks}
        </div>
      </div>
    `;

    const subscribeHref = pathname === '/' ? '#newsletter' : '/#newsletter';

    return `
      <div class="topline">
        <div class="wrap topline-inner">
          <span>Machine Report World • THE WORLD OF MACHINES. CONNECTED.</span>
          <span id="today-label">GLOBAL B2B EQUIPMENT &amp; FLEET INTELLIGENCE</span>
        </div>
      </div>
      <header class="site-header" role="banner">
        <div class="wrap header-main">
          <a class="brand" href="/" aria-label="Machine Report World home"${pathname === '/' ? ' aria-current="page"' : ''}>
            <span class="brand-mark">MRW<span>+</span></span>
            <span class="brand-words">MACHINE REPORT <span>WORLD</span><small>THE WORLD OF MACHINES. CONNECTED.</small></span>
          </a>
          <div class="header-actions">
            <form id="header-search-form" class="search-box header-search" role="search" action="/category/construction-equipment" method="get">
              <label class="sr-only" for="header-search-input">Search Machine Report World</label>
              <input id="header-search-input" name="q" type="search" placeholder="Search machines, OEMs, specs…" aria-label="Search Machine Report World">
              <button type="submit" aria-label="Submit search">⌕</button>
            </form>
            <a class="button button-amber header-subscribe-btn" href="${subscribeHref}">Subscribe</a>
            <button class="menu-toggle" id="menu-toggle" type="button" aria-label="Toggle navigation menu" aria-expanded="false" aria-controls="nav-inner">☰</button>
          </div>
        </div>
        <nav class="nav-bar" aria-label="Primary navigation">
          <div class="wrap nav-inner" id="nav-inner">
            ${navItemsHtml}
            ${regionHtml}
            <div class="nav-item nav-item-subscribe">
              <a class="nav-link nav-subscribe-link" href="${subscribeHref}">Subscribe</a>
            </div>
          </div>
        </nav>
      </header>
    `;
  }

  function buildFooterHtml() {
    const year = new Date().getFullYear();
    const pathname = (window.location.pathname || '/').replace(/\/+$/, '') || '/';
    const policyLinks = [
      { href: '/about.html', label: 'About' },
      { href: '/contact.html', label: 'Contact' },
      { href: '/editorial-policy.html', label: 'Editorial Policy' },
      { href: '/corrections.html', label: 'Corrections Policy' },
      { href: '/privacy.html', label: 'Privacy' },
      { href: '/terms.html', label: 'Terms' },
      { href: '/advertise.html', label: 'Advertise' },
      { href: '/rss.xml', label: 'RSS' },
      { href: '/admin.html', label: 'Admin' }
    ].map(link => {
      const current = pathname === link.href ? ' aria-current="page"' : '';
      return `<a href="${link.href}"${current}>${link.label}</a>`;
    }).join('');

    return `
      <footer class="site-footer" role="contentinfo" aria-label="Site footer">
        <div class="wrap footer-top">
          <a class="brand footer-brand" href="/">
            <span class="brand-mark">MRW<span>+</span></span>
            <span class="brand-words">MACHINE REPORT <span>WORLD</span><small>THE WORLD OF MACHINES. CONNECTED.</small></span>
          </a>
          <p>Authoritative global news, specification intelligence and market reporting for the construction equipment, agricultural machinery, and commercial vehicle industries.</p>
          <nav class="footer-links" aria-label="Footer institutional links">
            ${policyLinks}
          </nav>
        </div>
        <div class="wrap footer-bottom">
          <span>© <span id="year">${year}</span> MACHINE REPORT WORLD — THE WORLD OF MACHINES. CONNECTED.</span>
          <span>Verify every announcement against its original primary source.</span>
        </div>
      </footer>
    `;
  }

  function bindHeaderEvents(root) {
    const toggleBtn = root.querySelector('#menu-toggle');
    const navInner = root.querySelector('#nav-inner');
    if (toggleBtn && navInner) {
      toggleBtn.addEventListener('click', () => {
        const isOpen = navInner.classList.toggle('open');
        toggleBtn.setAttribute('aria-expanded', String(isOpen));
      });
    }

    const dropdownItems = Array.from(root.querySelectorAll('.nav-item.has-dropdown'));
    function closeAllDropdowns(exceptItem) {
      dropdownItems.forEach(item => {
        if (item !== exceptItem) {
          item.classList.remove('open');
          const btn = item.querySelector('.nav-dropdown-toggle');
          if (btn) btn.setAttribute('aria-expanded', 'false');
        }
      });
    }

    dropdownItems.forEach(item => {
      const btn = item.querySelector('.nav-dropdown-toggle');
      if (!btn) return;

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const willOpen = !item.classList.contains('open');
        closeAllDropdowns(item);
        item.classList.toggle('open', willOpen);
        btn.setAttribute('aria-expanded', String(willOpen));
      });

      item.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          item.classList.remove('open');
          btn.setAttribute('aria-expanded', 'false');
          btn.focus();
        } else if (e.key === 'ArrowDown') {
          const firstLink = item.querySelector('.nav-dropdown a');
          if (firstLink) {
            e.preventDefault();
            item.classList.add('open');
            btn.setAttribute('aria-expanded', 'true');
            firstLink.focus();
          }
        }
      });

      item.addEventListener('focusout', (e) => {
        setTimeout(() => {
          if (!item.contains(document.activeElement)) {
            item.classList.remove('open');
            btn.setAttribute('aria-expanded', 'false');
          }
        }, 10);
      });
    });

    document.addEventListener('click', (e) => {
      if (!root.contains(e.target)) {
        closeAllDropdowns(null);
      }
    });

    const searchForm = root.querySelector('#header-search-form');
    const searchInput = root.querySelector('#header-search-input');
    if (searchForm && searchInput) {
      searchForm.addEventListener('submit', (e) => {
        const q = searchInput.value.trim();
        const mainSearchInput = document.querySelector('#search-input');
        if (window.location.pathname === '/' && mainSearchInput) {
          e.preventDefault();
          mainSearchInput.value = q;
          mainSearchInput.dispatchEvent(new Event('input', { bubbles: true }));
          const latestEl = document.querySelector('#latest');
          if (latestEl) latestEl.scrollIntoView({ behavior: 'smooth' });
        }
      });
    }
  }

  function initSharedLayout() {
    const headerContainer = document.getElementById('site-header');
    if (headerContainer) {
      headerContainer.innerHTML = buildHeaderHtml();
      bindHeaderEvents(headerContainer);
    }
    const footerContainer = document.getElementById('site-footer');
    if (footerContainer) {
      footerContainer.innerHTML = buildFooterHtml();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSharedLayout);
  } else {
    initSharedLayout();
  }

  window.MRWLayout = {
    DESK_NAV_ITEMS,
    REGION_ITEMS,
    initSharedLayout
  };
})();
