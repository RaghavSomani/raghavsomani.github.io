source "https://rubygems.org"

# This line ensures you're using the github-pages gem, which includes
# a specific version of Jekyll and other dependencies that match the GitHub Pages environment.
gem "github-pages", "230", group: :jekyll_plugins

# The wdm gem is a Windows-specific gem to handle file change events efficiently.
# It's only needed when developing on Windows.
gem "wdm", "~> 0.1.0", :platforms => [:mswin, :mingw, :x64_mingw, :jruby]

# Jekyll plugins group
group :jekyll_plugins do
  gem "jekyll-feed"
  gem "jekyll-sitemap"
end
