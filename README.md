# Net Tools for Even Realities G2

Nettverks-jukselapper og subnettkalkulator for Even Realities G2-brillene, laget med [Even Hub SDK](https://www.npmjs.com/package/@evenrealities/even_hub_sdk).

## Hva den gjør

**På brillene** (meny → velg med touchpad):

| Ark | Innhold |
| --- | --- |
| Subnets (/32 → /8) | Liste med minste subnett øverst. Klikk på et subnett for detaljer: maske, wildcard, blokkstørrelse, antall hoster, og eksempeladresser (nettverk, første/siste host, broadcast, neste subnett) |
| Mask octets & blocks | Oktettverdier, blokkstørrelser, huskeregler |
| Wildcard masks | /32–/16 wildcard (ACL/OSPF) |
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
- Subnett-tabell (minste først) der hvert subnett kan åpnes med eksempeladresser.
- Alle jukselappene, med knapp for å vise dem på brillene.

### Kontroller på brillene

| Gest | Meny / lister | Jukselapp / subnett-detaljer |
| --- | --- | --- |
| Scroll | Flytt markering | Forrige / neste side. I subnett-detaljer: forbi siste side → neste større subnett (/26 → /25), forbi første side → neste mindre (/26 → /27) |
| Klikk | Åpne | Neste side (siste side → tilbake) |
| Dobbeltklikk | Tilbake (avslutt fra hovedmenyen) | Tilbake |

Subnett-detaljene har tre sider: **1)** maske, wildcard, hoster, blokkstørrelse, bruksområde og binær maske, **2)** eksempel (f.eks. `192.168.1.0/26`) med nettverk, første/siste host, broadcast og neste subnett, **3)** de første subnettene i overliggende blokk (f.eks. alle fire /26 i `192.168.1.0/24`).

G2-firmwaren tillater maks 20 elementer i en liste, så subnettlisten viser /32 → /16, og siste element åpner /15 → /8.

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
