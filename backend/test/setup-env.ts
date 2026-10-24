// Las pruebas e2e no deben depender del .env local del desarrollador: aquí se fija lo que
// cambia el comportamiento. Las pruebas que necesitan otro valor lo sustituyen con overrideProvider.
process.env.FRONTEND_URL = '';