# Net Tools for Even Realities G2

Nettverks-jukselapper og subnettkalkulator for Even Realities G2-brillene, laget med [Even Hub SDK](https://www.npmjs.com/package/@evenrealities/even_hub_sdk).

## Hva den gjør

**På brillene** (meny → velg med touchpad):

| Ark | Innhold |
| --- | --- |
| Subnet / CIDR table | /8–/32 → maske og antall hoster |
| Mask octets & blocks | Oktettverdier, blokkstørrelser, huskeregler |
| Wildcard masks | /16–/32 wildcard (ACL/OSPF) |
| Private & special IPv4 | RFC 1918, CGNAT, loopback, link-local, TEST-NET … |
| Classful ranges | Klasse A–E |
| Common ports | ~40 vanlige porter |
| IPv6 cheat sheet | Adressetyper, multicast, prefiksstørrelser |
| OSI model | 7 lag + TCP/IP |
| Troubleshooting cmds | Linux/macOS- og Windows-kommandoer |
| MTU, headers & VLAN | MTU, header-størrelser, DF-ping |
| Calculator result | Siste beregning fra telefonen |

**På telefonen** (siden i Even-appen):

- Subnettkalkulator: skriv `192.168.1.10/26` eller `10.0.0.5 255.255.255.0` → nettverk, broadcast, første/siste host, wildcard, antall hoster, type adresse. Resultatet sendes rett til brillene.
- Del opp et nettverk i mindre subnett.
- Alle jukselappene, med knapp for å vise dem på brillene.

### Kontroller på brillene

| Gest | Meny | Jukselapp |
| --- | --- | --- |
| Scroll | Flytt markering | Forrige / neste side |
| Klikk | Åpne | Neste side (siste side → meny) |
| Dobbeltklikk | Avslutt app | Tilbake til meny |

## Kom i gang

Krever Node 20.17+ / 22.13+ og Even-appen 2.2.10 eller nyere.

```bash
npm install
```

```bash
npm run dev
```

Åpne `http://localhost:5173` i en nettleser for å få en simulert G2-skjerm (piltaster = scroll, Enter = klikk, Esc = dobbeltklikk).

### Test på ekte briller

Med `npm run dev` kjørende, på samme Wi-Fi som telefonen:

```bash
npx evenhub qr --port 5173
```

Skann QR-koden i Even-appen (utviklermodus).

### Bygg pakke (.ehpk)

```bash
npm run pack
```

Gir `nettools.ehpk`. Last opp med `npx evenhub login` og `npx evenhub create nettools.ehpk --name "Net Tools" --tagline "Network cheat sheets"`. Bytt gjerne `package_id` i `app.json` til ditt eget navnerom først.

### Tester

```bash
npm test
```

## Struktur

```
src/subnet.ts       IPv4-matte (ren logikk, testet)
src/content.ts      Jukselapp-innhold + sideoppdeling
src/glasses.ts      Brille-UI: meny (list container) og sidevisning (text containers)
src/mock-bridge.ts  Simulert G2-skjerm for nettleseren
src/main.ts         Telefon-UI og oppstart
app.json            Even Hub-manifest
```

## Merknader

- Appen trenger ingen tillatelser (ingen nettverk, mikrofon e.l.) — alt kjører lokalt.
- G2-skjermen er 576×288. Linjene holdes under ~42 tegn og 8 linjer per side; juster `LINES_PER_PAGE` i `src/glasses.ts` hvis teksten blir for stor/liten på dine briller.

## Lisens

MIT
