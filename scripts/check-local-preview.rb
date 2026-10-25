# frozen_string_literal: true

# Run from the repository root: bundle exec ruby scripts/check-local-preview.rb
require "fileutils"
require "net/http"
require "shellwords"
require "socket"
require "tmpdir"
require "timeout"

root = File.expand_path("..", __dir__)
launcher = File.read(File.join(root, "serve-local.bat"))
arguments = launcher.match(/bundle exec jekyll serve ([^"]+)"/)
abort "Cannot locate the preview command" unless arguments
arguments = Shellwords.split(arguments[1])
abort "Preview must bind localhost:4000" unless arguments.each_cons(2).include?(["--host", "localhost"]) &&
  arguments.each_cons(2).include?(["--port", "4000"])

def listening?(port)
  TCPSocket.new("localhost", port).close
  true
rescue Errno::ECONNREFUSED
  false
end

abort "Ports 4000 and 35729 must be free before this check" if listening?(4000) || listening?(35729)

def get(path)
  Net::HTTP.start("localhost", 4000, :open_timeout => 2, :read_timeout => 2) do |http|
    http.get(path)
  end
end

def eventually
  Timeout.timeout(180) do
    loop do
      begin
        return if yield
      rescue Errno::ECONNREFUSED, EOFError, Net::ReadTimeout
        # The preview may still be building or starting.
      end
      sleep 0.5
    end
  end
end

Dir.mktmpdir("local-preview-check") do |temporary|
  probe_name = "preview-regression-#{Process.pid}.txt"
  probe = File.join(root, probe_name)
  log = File.join(temporary, "server.log")
  pid = nil
  begin
    File.write(probe, "---\nlayout: null\n---\npreview-before\n")
    File.open(log, "w") do |output|
      pid = Process.spawn("bundle", "exec", "jekyll", "serve", *arguments,
                          "--destination", File.join(temporary, "site"),
                          :chdir => root, :out => output, :err => output)
    end
    eventually { get("/" + probe_name).body.include?("preview-before") }
    response = get("/")
    raise "HTTP preview did not return 200" unless response.code == "200"
    raise "LiveReload script was injected" if response.body.include?("livereload.js")
    raise "Vulnerable LiveReload listener is running" if listening?(35729)
    raise "LiveReload reactor started" if File.read(log).include?("LiveReload address:")

    File.write(probe, "---\nlayout: null\n---\npreview-after\n")
    eventually { get("/" + probe_name).body.include?("preview-after") }
    raise "LiveReload listener started during rebuilding" if listening?(35729)
    raise "HTTP preview stopped after rebuilding" unless get("/").code == "200"
    puts "PASS: HTTP preview and file rebuilding work; LiveReload listener and injection are absent."
  rescue StandardError
    warn File.read(log) if File.exist?(log)
    raise
  ensure
    FileUtils.rm_f(probe)
    if pid
      begin
        Process.kill("TERM", pid)
        Timeout.timeout(10) { Process.wait(pid) }
      rescue Errno::ESRCH, Errno::ECHILD
        # Already stopped.
      rescue Timeout::Error
        Process.kill("KILL", pid)
        Process.wait(pid)
      end
    end
  end
end
