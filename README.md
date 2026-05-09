# La Banca del Finde

App estatica para seguir apuestas deportivas grupales: stake, cuota, estado, balance, ROI y rendimiento de la banda.

## Como hostearla en GitHub Pages

1. Crear un repo nuevo en GitHub.
2. Subir estos archivos al repo:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `README.md`
3. En GitHub, entrar a `Settings`.
4. Ir a `Pages`.
5. En `Build and deployment`, elegir:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/root`
6. Guardar.

GitHub va a publicar la pagina en una URL parecida a:

```text
https://TU-USUARIO.github.io/NOMBRE-DEL-REPO/
```

## Importante

La app no usa backend. Los datos se guardan en el navegador con `localStorage`.

Para compartir el estado entre ustedes, usen `Exportar` e `Importar`. Si quieren que todos vean los mismos tickets en vivo desde distintos celulares, el siguiente paso es conectarla a una base compartida como Supabase o Firebase.
