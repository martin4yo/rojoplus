# Informe — Huecos en Nro. Socio (tenant `sportivopilar`)

Fecha: 2026-05-04
Tenant: **sportivopilar** (id=1, "Club Sportivo Pilar")

## Resumen general

| Métrica | Valor |
|---|---|
| Socios totales | **4.593** |
| Nº socio mínimo | 2 |
| Nº socio máximo | 168.491 |
| Rango total cubierto | 168.490 números |
| Huecos totales (2..168.491) | **163.897** |
| Rangos de huecos | 423 |
| Socios con nº no numérico | 0 |

> El rango aparente es enorme porque hay un **salto de esquema** entre 20.831 y 167.232 (146.372 números vacíos seguidos). En la práctica conviene analizar los huecos en **dos bloques**: numeración histórica (2–20.999) y numeración nueva (167.000+).

## Distribución por estado

| Estado | Cantidad |
|---|---|
| BAJA POR MOROSIDAD | 2.390 |
| BAJA POR RENUNCIA | 1.112 |
| **VIGENTE** | **1.048** |
| BAJA POR FALLECIMIENTO | 41 |
| BAJA POR COMISION DIRECTIVA | 2 |

## Distribución por bloques de mil (con socios)

```
     0 -    999 :   23
  1000 -   1999 :   27
  2000 -   2999 :   36
  3000 -   3999 :   14
  4000 -   4999 :   29
  5000 -   5999 :   10
  6000 -   6999 :   46
  7000 -   7999 :    1
  8000 -   8999 :   28
  9000 -   9999 :  135
 10000 -  10999 :   35
 11000 -  11999 :   10
 12000 -  12999 :    8
 13000 -  13999 :    1
 14000 -  14999 :   14
 15000 -  15999 :  170
 16000 -  16999 :  973
 17000 -  17999 :  963
 18000 -  18999 :   97
 19000 -  19999 :  982
 20000 -  20999 :  856
 ---- (gap de 146k) ----
167000 - 167999 :  125
168000 - 168999 :   10
```

La masa de socios actuales se concentra en **15.000–20.999** (4.041 socios, ~88% del padrón).

## Huecos en la numeración histórica (2 – 20.999)

- **16.540 huecos**
- **376 rangos** de hueco

Distribución por tamaño de rango:

| Tamaño del rango | # de rangos |
|---|---|
| 1 número | 100 |
| 2–5 | 55 |
| 6–20 | 71 |
| 21–100 | 107 |
| 101–500 | 40 |
| 500+ | 3 |

### Huecos individuales (100 candidatos para reasignación 1 a 1)

```
45, 62, 2348, 2354, 2862, 4812, 6756, 6780, 8474, 9111,
9389, 9469, 9652, 9700, 9835, 10277, 10625, 15061, 15073, 15093,
15100, 15102, 15147, 15171, 15776, 15809, 15935, 16052, 16056, 16169,
16182, 16184, 16187, 16254, 16286, 16305, 16309, 16434, 16440, 16505,
16508, 16520, 16644, 16646, 16691, 16816, 16819, 16911, 16913, 16959,
...y 50 más
```

(lista completa disponible al regenerar el reporte)

### Top 20 rangos vacíos más grandes (debajo de 21.000)

| Inicio | Fin | Nº de números |
|---|---|---|
| 7.049 | 8.006 | **958** |
| 18.100 | 18.999 | **900** |
| 13.222 | 14.039 | **818** |
| 64 | 543 | 480 |
| 11.781 | 12.158 | 378 |
| 10.863 | 11.173 | 311 |
| 8.028 | 8.290 | 263 |
| 14.041 | 14.297 | 257 |
| 5.984 | 6.235 | 252 |
| 12.988 | 13.220 | 233 |
| 576 | 800 | 225 |
| 862 | 1.077 | 216 |
| 12.669 | 12.880 | 212 |
| 12.160 | 12.367 | 208 |
| 3.776 | 3.980 | 205 |
| 4.934 | 5.137 | 204 |
| 3.118 | 3.307 | 190 |
| 11.305 | 11.491 | 187 |
| 5.674 | 5.858 | 185 |
| 6.318 | 6.499 | 182 |

## Huecos en la numeración nueva (167.000+)

- 135 socios en `167.xxx`, 10 en `168.xxx` (135 totales en este bloque).
- Varios huecos densos: por ejemplo `167.241–167.292`, `167.344–167.473`, `167.511–167.602`, `167.760–167.798`, `168.196–168.371`, `168.394–168.466`.
- Si la numeración nueva sigue secuencialmente desde el último (168.491), el próximo libre "natural" es **168.492**.

## El gran salto: 20.860 – 167.231

Entre el último de la numeración vieja (`20.859`/aprox.) y el primero de la nueva (`167.232`) hay un hueco de **146.372 números**. No son números reutilizables — corresponden a un cambio de esquema (probablemente migración o renumeración importada). **Recomendación: no usarlos** para nuevas asignaciones.

## Conclusiones / sugerencias

1. **Reutilizar los 100 huecos individuales** del bloque histórico antes de avanzar la numeración. Son los más simples y no rompen continuidad visible.
2. Si querés "compactar" rellenando rangos chicos, los **283 rangos** de tamaño 1–20 (100 + 55 + 71 + ¿57?) representan ~700 números recuperables sin chocar con la cronología de altas.
3. Los **3 rangos de 500+** (7.049–8.006, 18.100–18.999, 13.222–14.039) seguramente reflejan bajas masivas o saltos administrativos — verificar si tiene sentido reutilizarlos o mantenerlos como "memoria histórica".
4. El gap 20.860–167.231 **no se debe usar**: marca el quiebre entre dos esquemas de numeración.
5. Si la política es "siempre incrementar", el próximo número disponible sería **168.492**.
