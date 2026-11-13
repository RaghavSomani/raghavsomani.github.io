/*
* Greedy Navigation
*
* http://codepen.io/lukejacksonn/pen/PwmwWV
*
*/

var $nav = $('#site-nav');
var $btn = $('#site-nav button');
var $vlinks = $('#site-nav .visible-links');
var $hlinks = $('#site-nav .hidden-links');
var measuredNavWidth;

function closeNavMenu() {
  $hlinks.addClass('hidden').attr('aria-hidden', 'true');
  $btn.removeClass('close').attr({
    'aria-expanded': 'false',
    'aria-label': 'Open navigation menu'
  });
}

function updateNav() {
  var wasOpen = $btn.attr('aria-expanded') === 'true';
  var focusedElement = document.activeElement;
  measuredNavWidth = $nav.width();
  // Start from the complete navigation on every measurement. This prevents a
  // narrow first render from leaving links hidden after the viewport expands.
  while ($hlinks.children().length) {
    $hlinks.children().first().appendTo($vlinks);
  }

  closeNavMenu();
  $btn.addClass('hidden');

  var availableSpace = $nav.width();

  if ($vlinks.width() > availableSpace) {
    $btn.removeClass('hidden');
    availableSpace = $nav.width() - $btn.outerWidth() - 30;

    while ($vlinks.width() > availableSpace && $vlinks.children().length > 1) {
      $vlinks.children().last().prependTo($hlinks);
    }
  }

  var hiddenCount = $hlinks.children().length;
  $btn.attr('count', hiddenCount).toggleClass('hidden', hiddenCount === 0);

  if (wasOpen && hiddenCount) {
    $hlinks.removeClass('hidden').attr('aria-hidden', 'false');
    $btn.addClass('close').attr({
      'aria-expanded': 'true',
      'aria-label': 'Close navigation menu'
    });
  }
  if (focusedElement && $nav[0] && $nav[0].contains(focusedElement)) {
    if ($(focusedElement).is(':visible')) focusedElement.focus();
    else if (hiddenCount) $btn.trigger('focus');
  }
}

// Window listeners

$(window).resize(function() {
  if ($nav.width() !== measuredNavWidth) updateNav();
});

if (window.ResizeObserver && $nav.length) {
  var navResizeObserver = new ResizeObserver(function(entries) {
    if (entries[0].contentRect.width !== measuredNavWidth) updateNav();
  });
  navResizeObserver.observe($nav[0]);
}

$btn.on('click', function() {
  var willOpen = $hlinks.hasClass('hidden');
  $hlinks.toggleClass('hidden', !willOpen).attr('aria-hidden', String(!willOpen));
  $btn.toggleClass('close', willOpen).attr({
    'aria-expanded': String(willOpen),
    'aria-label': willOpen ? 'Close navigation menu' : 'Open navigation menu'
  });
});

$(document).on('keyup.greedyNav', function(event) {
  if (event.key === 'Escape' && $btn.attr('aria-expanded') === 'true') {
    closeNavMenu();
    $btn.focus();
  }
});

updateNav();

$(window).on('load', updateNav);
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(updateNav);
}
