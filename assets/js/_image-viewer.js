(() => {
  const links = $(".image-popup").not(".page__comments a, .js-comment a");
  links.magnificPopup({
    type: "image",
    tLoading: "Loading image #%curr%...",
    gallery: { enabled: true, navigateByImgClick: true, preload: [0, 1] },
    image: { tError: "Image #%curr% could not be loaded." },
    removalDelay: 500,
    mainClass: "mfp-zoom-in",
    callbacks: {
      beforeOpen() {
        this.st.image.markup = this.st.image.markup.replace("mfp-figure", "mfp-figure mfp-with-anim");
      }
    },
    closeOnContentClick: true,
    midClick: true
  });
})();
