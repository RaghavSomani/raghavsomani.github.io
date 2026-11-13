/* ==========================================================================
   jQuery plugin settings and other scripts
   ========================================================================== */

$(document).ready(function(){

  // FitVids init
  $("#main").fitVids();

  // init sticky sidebar
  $(".sticky").Stickyfill();

  var profileIsDesktop;
  var stickySideBar = function(){
    var $authorToggle = $(".author__urls-toggle");
    var $authorLinks = $("#author-profile-links");
    var show = $authorToggle.length === 0 ? $(window).width() > 1024 : !$authorToggle.is(":visible");
    // A mobile toolbar resize must not reset the visitor's open menu.
    if (show === profileIsDesktop) return;
    profileIsDesktop = show;
    if (show) {
      // fix
      Stickyfill.rebuild();
      Stickyfill.init();
      $authorLinks.stop(true, true).show().attr("aria-hidden", "false");
    } else {
      // unfix
      Stickyfill.stop();
      $authorLinks.stop(true, true).hide().attr("aria-hidden", "true");
      $authorToggle.removeClass("open").attr("aria-expanded", "false");
    }
  };

  stickySideBar();

  $(window).resize(function(){
    stickySideBar();
  });

  // Follow menu drop down

  $(".author__urls-toggle").on("click", function() {
    var $button = $(this);
    var $links = $("#" + $button.attr("aria-controls"));
    var willOpen = $button.attr("aria-expanded") !== "true";
    $links.stop(true, true).fadeToggle("fast").attr("aria-hidden", String(!willOpen));
    $button.toggleClass("open", willOpen).attr("aria-expanded", String(willOpen));
  });

  // Name pronunciation

  $(".author__pronunciation").on("click", function() {
    var audio = document.getElementById($(this).attr("aria-controls"));
    var $status = $("#name-audio-status");
    var showPlaybackError = function() {
      $status.text("Pronunciation audio could not be played.");
    };

    $status.text("");
    if (!audio) {
      showPlaybackError();
      return;
    }

    try {
      var playback = audio.play();
      if (playback && typeof playback.catch === "function") {
        playback.catch(showPlaybackError);
      }
    } catch (error) {
      showPlaybackError();
    }
  });

  // init smooth scroll
  // Native anchor focus is essential for the skip link.
  $("a").not(".skip-link").smoothScroll({offset: -20});

  // Keep comment links out of both automatic and explicit lightbox binding.
  var $imageLinks = $(".image-popup,a[href$='.jpg'],a[href$='.jpeg'],a[href$='.JPG'],a[href$='.png'],a[href$='.gif']")
    .not(".page__comments a, .js-comment a");
  $imageLinks.addClass("image-popup");

  // Magnific-Popup options
  $imageLinks.magnificPopup({
    // disableOn: function() {
    //   if( $(window).width() < 500 ) {
    //     return false;
    //   }
    //   return true;
    // },
    type: 'image',
    tLoading: 'Loading image #%curr%...',
    gallery: {
      enabled: true,
      navigateByImgClick: true,
      preload: [0,1] // Will preload 0 - before current, and 1 after the current image
    },
    image: {
      tError: 'Image #%curr% could not be loaded.',
    },
    removalDelay: 500, // Delay in milliseconds before popup is removed
    // Class that is added to body when popup is open.
    // make it unique to apply your CSS animations just to this exact popup
    mainClass: 'mfp-zoom-in',
    callbacks: {
      beforeOpen: function() {
        // just a hack that adds mfp-anim class to markup
        this.st.image.markup = this.st.image.markup.replace('mfp-figure', 'mfp-figure mfp-with-anim');
      }
    },
    closeOnContentClick: true,
    midClick: true // allow opening popup on middle mouse click. Always set it to true if you don't provide alternative source.
  });

});
