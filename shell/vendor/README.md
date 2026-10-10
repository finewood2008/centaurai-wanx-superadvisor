# WANX service discovery

`wanx-discovery.mjs` is reused unchanged from the current Zhijun LAN client:

`知君客户端 server/lan-discovery.mjs`

Copied 2026-10-10. It discovers `_wanx._tcp` with Bonjour and macOS dns-sd, probes public health/captcha/identity endpoints without credentials, and accepts explicit private/loopback IPv4 origins. It does not scan subnets or provide remote pairing. It runs in Electron's main process. Account login and all meeting requests continue through `centaurai-wanx`; tokens stay in `AdvisorySession`.
