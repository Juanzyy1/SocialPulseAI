import { shapeProblems } from './shape';

describe('shapeProblems', () => {
  it('no encuentra problemas si la respuesta tiene los campos del contrato, aunque los valores sean distintos', () => {
    expect(shapeProblems({ a: 'x', b: 2, c: true }, { a: 'otro', b: 99, c: false })).toEqual([]);
  });

  it('informa un campo que falta, con su ruta', () => {
    expect(shapeProblems({ a: 'x' }, { a: 'x', b: 2 })).toEqual(['$.b: falta el campo']);
  });

  it('informa campos que faltan dentro de objetos y de elementos de arreglos', () => {
    const actual = { user: { name: 'Ana' }, items: [{ id: 1 }] };
    const expected = { user: { name: 'x', email: 'x' }, items: [{ id: 1, label: 'x' }] };

    expect(shapeProblems(actual, expected)).toEqual([
      '$.user.email: falta el campo',
      '$.items[0].label: falta el campo',
    ]);
  });

  it('permite campos extra en la respuesta: agregar campos no rompe al frontend', () => {
    expect(shapeProblems({ a: 1, extra: 'x', otro: { y: 1 } }, { a: 1 })).toEqual([]);
  });

  it('un null en el contrato admite cualquier valor real', () => {
    for (const actual of ['texto', 5, true, null, { x: 1 }, [1]]) {
      expect(shapeProblems({ a: actual }, { a: null })).toEqual([]);
    }
  });

  it('un valor no nulo en el contrato no admite un null en la respuesta', () => {
    expect(shapeProblems({ a: null }, { a: 'x' })).toEqual(['$.a: se esperaba string y llegó null']);
  });

  it('informa un tipo distinto', () => {
    expect(shapeProblems({ a: 5, b: 'x' }, { a: 'x', b: 1 })).toEqual([
      '$.a: se esperaba string y llegó number',
      '$.b: se esperaba number y llegó string',
    ]);
  });

  it('de un arreglo compara el primer elemento, y un contrato de arreglo vacío no verifica nada', () => {
    expect(shapeProblems({ l: [{ a: 1 }, { zzz: 1 }] }, { l: [{ a: 1 }] })).toEqual([]);
    expect(shapeProblems({ l: [1, 2, 3] }, { l: [] })).toEqual([]);
    expect(shapeProblems({ l: [] }, { l: [] })).toEqual([]);
  });

  it('un contrato con elementos no se puede verificar con una respuesta vacía', () => {
    expect(shapeProblems({ l: [] }, { l: [{ a: 1 }] })).toEqual([
      '$.l: el arreglo está vacío y no se puede verificar su contenido',
    ]);
  });

  it('informa si se esperaba un objeto o un arreglo y llegó otra cosa', () => {
    expect(shapeProblems({ o: [] }, { o: { a: 1 } })).toEqual(['$.o: se esperaba un objeto']);
    expect(shapeProblems({ o: null }, { o: { a: 1 } })).toEqual(['$.o: se esperaba un objeto']);
    expect(shapeProblems({ l: {} }, { l: [1] })).toEqual(['$.l: se esperaba un arreglo']);
  });

  it('la ruta del problema incluye objetos y arreglos anidados', () => {
    expect(shapeProblems({ a: [{ b: { c: 1 } }] }, { a: [{ b: { c: 'x' } }] })).toEqual([
      '$.a[0].b.c: se esperaba string y llegó number',
    ]);
  });
});