// GitHub contribution heatmap on the homepage. Data comes from
// /api/github-contributions; if that fails the whole block removes itself.
(function () {
  var root = document.querySelector('[data-contributions]');
  if (!root) return;

  var grid = root.querySelector('.contrib-grid');
  var tip = root.querySelector('.contrib-tip');

  fetch('/api/github-contributions')
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(render)
    .catch(function () {
      root.remove();
    });

  function render(data) {
    if (!data.days || !data.days.length) throw new Error('empty');

    // Days run oldest to newest down each column, then left to right. The CSS
    // sets the row count and trims the oldest days so the visible block is a
    // full rectangle ending with today in the bottom-right corner.
    var rows = parseInt(getComputedStyle(grid).getPropertyValue('--rows'), 10);
    var last = data.days.length - 1;

    var frag = document.createDocumentFragment();
    data.days.forEach(function (day, i) {
      var el = document.createElement('span');
      el.className = 'contrib-cell';
      el.dataset.level = day.level;
      el.dataset.tip = label(day);
      // columns counted back from today, so the fade-in sweeps across
      // whichever columns are actually visible at this width
      el.style.setProperty('--from-end', Math.floor((last - i) / rows));
      frag.appendChild(el);
    });
    grid.appendChild(frag);
    grid.setAttribute('aria-label', data.total.toLocaleString('en-US') + ' GitHub contributions in the last year');
  }

  function label(day) {
    var when = new Date(day.date + 'T00:00:00Z').toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'
    });
    var what = day.count === 0 ? 'No contributions'
      : day.count === 1 ? '1 contribution'
      : day.count.toLocaleString('en-US') + ' contributions';
    return what + ' on ' + when;
  }

  grid.addEventListener('mouseover', function (e) {
    var cell = e.target.closest('.contrib-cell');
    if (!cell) return;
    tip.textContent = cell.dataset.tip;
    // Centre over the cell, but keep the tooltip inside the block's edges.
    var half = tip.offsetWidth / 2;
    var x = cell.offsetLeft + cell.offsetWidth / 2;
    x = Math.min(Math.max(x, half), root.clientWidth - half);
    tip.style.left = x + 'px';
    tip.style.top = cell.offsetTop + 'px';
    tip.classList.add('is-visible');
  });

  grid.addEventListener('mouseleave', function () {
    tip.classList.remove('is-visible');
  });
})();
