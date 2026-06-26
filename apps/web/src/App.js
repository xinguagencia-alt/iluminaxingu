import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const problemTypes = [
    "Lampada apagada",
    "Lampada piscando",
    "Luminaria acesa durante o dia",
    "Luminaria danificada",
    "Varios pontos apagados"
];
export default function App() {
    return (_jsxs("main", { className: "page-shell", children: [_jsxs("section", { className: "hero", children: [_jsx("p", { className: "eyebrow", children: "MVP em construcao" }), _jsx("h1", { children: "IluminaXingu" }), _jsx("p", { className: "hero-copy", children: "Registro digital de manutencao de iluminacao publica para Sao Felix do Xingu." })] }), _jsxs("section", { className: "grid", children: [_jsxs("article", { className: "card", children: [_jsx("h2", { children: "Abrir solicitacao" }), _jsxs("form", { className: "request-form", children: [_jsxs("label", { children: ["Nome", _jsx("input", { type: "text", placeholder: "Seu nome" })] }), _jsxs("label", { children: ["Telefone ou e-mail", _jsx("input", { type: "text", placeholder: "Contato para retorno" })] }), _jsxs("label", { children: ["Endereco", _jsx("input", { type: "text", placeholder: "Rua, numero e referencia" })] }), _jsxs("label", { children: ["Tipo do problema", _jsxs("select", { defaultValue: "", children: [_jsx("option", { value: "", disabled: true, children: "Selecione" }), problemTypes.map((type) => (_jsx("option", { value: type, children: type }, type)))] })] }), _jsxs("label", { children: ["Observacoes", _jsx("textarea", { rows: 4, placeholder: "Descreva o problema observado" })] }), _jsx("button", { type: "button", children: "Enviar solicitacao" })] })] }), _jsxs("article", { className: "card status-card", children: [_jsx("h2", { children: "Primeiros modulos" }), _jsxs("ul", { children: [_jsx("li", { children: "Portal do cidadao" }), _jsx("li", { children: "Central administrativa" }), _jsx("li", { children: "Cadastro de postes" }), _jsx("li", { children: "Ordens de servico" })] })] })] })] }));
}
