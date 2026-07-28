# Recursos visuales

Este directorio está reservado para los recursos visuales oficiales de Private Balance. Actualmente no contiene archivos reales: esta guía define qué se necesita y cómo debe generarse cuando esté disponible, para evitar imágenes rotas o inventadas en la documentación.

## Recursos previstos

| Recurso | Archivo sugerido | Notas |
|---|---|---|
| Logo principal | `logo.svg` / `logo.png` | Fondo transparente, legible en tema claro y oscuro |
| Isotipo | `isotype.svg` | Versión reducida del logo para favicon/app icon |
| Banner horizontal | `banner.png` | Para cabecera de README, 1200×400 px aprox. |
| Banner claro | `banner-light.png` | Variante para fondos claros |
| Banner oscuro | `banner-dark.png` | Variante para fondos oscuros |
| Capturas de producto | ver [screenshots/README.md](screenshots/README.md) | Con datos ficticios únicamente |
| GIF o vídeo corto | `demo.gif` / `demo.mp4` | Flujo breve (ej. registrar un ingreso), sin datos reales |

## Tamaños recomendados

- Iconos/isotipo: SVG vectorial o PNG a 512×512 px mínimo.
- Banners: 1200×400 px (relación 3:1), PNG u optimizado WebP.
- Capturas de pantalla: ver la guía específica en `screenshots/`.

## Convención de nombres

- Minúsculas, separadas por guiones: `banner-light.png`, `screenshot-income.png`.
- Sin espacios, acentos ni mayúsculas.
- Prefijo por área cuando aplique: `screenshot-`, `icon-`, `banner-`.

## Recomendaciones para ocultar datos sensibles

- No usar nunca datos financieros, nombres, correos o números de teléfono reales en un recurso que se vaya a versionar o publicar.
- Generar los datos de ejemplo directamente en la app (ver [screenshots/README.md](screenshots/README.md)) en lugar de editar capturas reales con herramientas externas.
- Revisar cada imagen antes de commitear: barras de estado del sistema operativo, notificaciones u otras apps visibles en segundo plano también pueden filtrar información.

## Estado actual

Ningún recurso de esta lista existe todavía en el repositorio. El README principal y la documentación no deben referenciar archivos de esta carpeta hasta que existan realmente.
