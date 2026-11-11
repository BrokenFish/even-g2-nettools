# Net Tools for Even Realities G2

Network cheat sheets and a subnet calculator for Even Realities G2 smart glasses, built with the [Even Hub SDK](https://www.npmjs.com/package/@evenrealities/even_hub_sdk).

## Features

**On the glasses** (menu → select with the touchpad):

| Sheet | Contents |
| --- | --- |
| Subnets (/32 → /8) | List with the smallest subnets at the top. Click a subnet for details: mask, wildcard, block size, host count, and example addresses (network, first/last host, broadcast, next subnet) |
| Mask octets & blocks | Octet values, block sizes, rules of thumb |
| Wildcard masks | /32–/16 wildcard masks (ACL/OSPF) |
| Private & special IPv4 | RFC 1918, CGNAT, loopback, link-local, TEST-NET … |
| Classful ranges | Classes A–E |
| Common ports | ~40 common ports |
| IPv6 cheat sheet | Address types, multicast, prefix sizes |
| OSI model | 7 layers + TCP/IP |
| Troubleshooting cmds | Linux/macOS and Windows commands |
| MTU, headers & VLAN | MTU, header sizes, DF ping |
| Calculator result | Latest calculation from the phone |

**On the phone** (the page inside the Even app):

- Subnet calculator: enter `192.168.1.10/26` or `10.0.0.5 255.255.255.0` → network, broadcast, first/last host, wildcard, host count, address type. The result is sent straight to the glasses.
- Split a network into smaller subnets.
- Subnet table (smallest first) where each subnet expands to show example addresses.
- All cheat sheets, each with a button to show it on the glasses.

### Controls on the glasses

| Gesture | Menu / lists | Cheat sheet / subnet details |
| --- | --- | --- |
| Scroll | Move selection | Previous / next page. In subnet details: past the last page → next larger subnet (/26 → /25), before the first page → next smaller subnet (/26 → /27) |
| Click | Open | Next page (last page → back) |
| Double-click | Back (exits from the main menu) | Back |

Subnet details have three pages: **1)** mask, wildcard, hosts, block size, typical use and binary mask, **2)** an example (e.g. `192.168.1.0/26`) with network, first/last host, broadcast and next subnet, **3)** the first subnets in the parent block (e.g. all four /26 networks in `192.168.1.0/24`).

The G2 firmware allows at most 20 items in a list, so the subnet list shows /32 → /16 and the last item opens /15 → /8.

## Getting started

Requires Node 20.17+ / 22.13+ and Even app 2.2.10 or later.

```bash
npm install
```

```bash
npm run dev
```

Open `http://localhost:5173` in a browser to get a simulated G2 display (arrow keys = scroll, Enter = click, Esc = double-click).

### Test on real glasses

With `npm run dev` running, on the same Wi-Fi as your phone:

```bash
npx evenhub qr --port 5173
```

Scan the QR code in the Even app (developer mode).

### Build a package (.ehpk)

```bash
npm run pack
```

This produces `nettools.ehpk`. Upload it with `npx evenhub login` and `npx evenhub create nettools.ehpk --name "Net Tools" --tagline "Network cheat sheets"`. Consider changing `package_id` in `app.json` to your own namespace first.

### Official simulator

With `npm run dev` running:

```bash
npm run sim
```

The automation API on port 9898 can take glasses screenshots: `curl -o shot.png http://127.0.0.1:9898/api/screenshot/glasses`.

### Tests

```bash
npm test
```

## Store listing

Everything for Even Hub is in [`store/`](store/): icon, cover, logo, screenshots from the official simulator, description ([`listing.md`](store/listing.md)), [privacy policy](store/privacy-policy.md) and [terms of use](store/terms-of-use.md).

## Project structure

```
src/subnet.ts       IPv4 math (pure logic, tested)
src/content.ts      Cheat sheet content + pagination
src/glasses.ts      Glasses UI: menus (list containers) and paged views (text containers)
src/mock-bridge.ts  Simulated G2 display for the browser
src/main.ts         Phone UI and startup
app.json            Even Hub manifest
```

## Notes

- The app needs no permissions (no network, microphone, etc.) — everything runs locally.
- The G2 display is 576×288. Lines are kept under ~42 characters and 8 lines per page; adjust `LINES_PER_PAGE` in `src/glasses.ts` if text is too large or small on your glasses.

## License

MIT
