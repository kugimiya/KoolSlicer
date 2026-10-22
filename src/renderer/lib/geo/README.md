# Geo pipeline



1. **import** — `importSvgGeometry`: SVG → `ElementGeometry[]` + `BoardRef` (mm).

2. **assemble** — `assembleRegions`: union изоляции; заливки/вырезы по слоям 1…N (на слое L — заливки L, затем вырезы L по накопленной заливке).

3. **validate** — bbox/limits before `ParseResult`.

4. **toolpath** — `generateRingsFromRegions` → изоляция PCB → G-code.



Entry: `parseSvgGeo` in `pipeline.ts`.


