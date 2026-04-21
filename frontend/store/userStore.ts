let nome = '';
let sobrenome = '';

export function setUser(n: string, s: string) {
    nome = n;
    sobrenome = s;
}

export function getUser() {
    return { nome, sobrenome };
}