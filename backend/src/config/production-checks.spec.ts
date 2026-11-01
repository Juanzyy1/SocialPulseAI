import { productionProblems } from './production-checks';

describe('productionProblems', () => {
  it('con ambos valores no hay problemas', () => {
    expect(productionProblems({ frontendUrl: 'https://app.ejemplo.com', trustProxyHops: 1 })).toEqual([]);
  });

  it('cero proxies es un valor válido: lo que se exige es indicarlo', () => {
    expect(productionProblems({ frontendUrl: 'https://app.ejemplo.com', trustProxyHops: 0 })).toEqual([]);
  });

  it('sin FRONTEND_URL (ausente o vacía) se informa', () => {
    for (const frontendUrl of [undefined, '']) {
      const problems = productionProblems({ frontendUrl, trustProxyHops: 1 });

      expect(problems).toHaveLength(1);
      expect(problems[0]).toContain('FRONTEND_URL');
    }
  });

  it('sin TRUST_PROXY_HOPS se informa y se explica qué valor poner', () => {
    const problems = productionProblems({ frontendUrl: 'https://app.ejemplo.com', trustProxyHops: undefined });

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('TRUST_PROXY_HOPS');
    expect(problems[0]).toContain('normalmente 1');
  });

  it('informa todo lo que falta a la vez', () => {
    expect(productionProblems({ frontendUrl: undefined, trustProxyHops: undefined })).toHaveLength(2);
  });
});