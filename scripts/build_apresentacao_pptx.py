from __future__ import annotations

import os
import shutil
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable
from xml.sax.saxutils import escape

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "output" / "pacote-apresentacao"
OUT_FILE = OUT_DIR / "IluminaXingu_apresentacao_ultra_premium_prefeitura_final.pptx"

LOGO_XINGU = OUT_DIR / "logo-xingu-agencia.png"
LOGO_ILUMINA = OUT_DIR / "logo-iluminaxingu-conceito.png"
TELAS = OUT_DIR / "telas-exemplo-iluminaxingu.png"

EMU_PER_INCH = 914400
SLIDE_W = 13.333
SLIDE_H = 7.5


def inches(value: float) -> int:
    return int(value * EMU_PER_INCH)


def pt(value: float) -> int:
    return int(value * 12700)


def rgb(hex_color: str) -> str:
    return hex_color.replace("#", "").upper()


def image_size(path: Path) -> tuple[int, int]:
    with Image.open(path) as im:
        return im.size


def fit_box(img_w: int, img_h: int, box_w: float, box_h: float) -> tuple[float, float]:
    img_ratio = img_w / img_h
    box_ratio = box_w / box_h
    if img_ratio > box_ratio:
        w = box_w
        h = box_w / img_ratio
    else:
        h = box_h
        w = box_h * img_ratio
    return w, h


def text_box(
    x: float,
    y: float,
    w: float,
    h: float,
    text: str,
    *,
    size: int = 20,
    color: str = "1B1B1B",
    bold: bool = False,
    align: str = "left",
    valign: str = "top",
    font: str = "Aptos",
    fill: str | None = None,
    line: str | None = None,
    radius: bool = False,
    margin: int = 10,
) -> str:
    fill_xml = f'<a:solidFill><a:srgbClr val="{rgb(fill)}"/></a:solidFill>' if fill else "<a:noFill/>"
    line_xml = (
        f'<a:ln><a:solidFill><a:srgbClr val="{rgb(line)}"/></a:solidFill><a:prstDash val="solid"/></a:ln>'
        if line
        else "<a:ln><a:noFill/></a:ln>"
    )
    rect = "roundRect" if radius else "rect"
    anchor = {"top": "t", "mid": "ctr", "bottom": "b"}[valign]
    align_attr = {"left": "l", "center": "ctr", "right": "r"}[align]
    paras = []
    for i, raw_line in enumerate(text.split("\n")):
        if i == 0:
            paras.append(
                f"""
                <a:p>
                  <a:pPr algn="{align_attr}"/>
                  <a:r>
                    <a:rPr lang="pt-BR" sz="{size*100}" b="{1 if bold else 0}">
                      <a:latin typeface="{font}"/>
                      <a:solidFill><a:srgbClr val="{rgb(color)}"/></a:solidFill>
                    </a:rPr>
                    <a:t>{escape(raw_line)}</a:t>
                  </a:r>
                </a:p>
                """
            )
        else:
            paras.append(
                f"""
                <a:p>
                  <a:pPr algn="{align_attr}"/>
                  <a:r>
                    <a:rPr lang="pt-BR" sz="{size*100}" b="{1 if bold else 0}">
                      <a:latin typeface="{font}"/>
                      <a:solidFill><a:srgbClr val="{rgb(color)}"/></a:solidFill>
                    </a:rPr>
                    <a:t>{escape(raw_line)}</a:t>
                  </a:r>
                </a:p>
                """
            )
    body = "".join(paras)
    return f"""
    <p:sp>
      <p:nvSpPr><p:cNvPr id="0" name="TextBox"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
      <p:spPr>
        <a:xfrm><a:off x="{inches(x)}" y="{inches(y)}"/><a:ext cx="{inches(w)}" cy="{inches(h)}"/></a:xfrm>
        <a:prstGeom prst="{rect}"><a:avLst/></a:prstGeom>
        {fill_xml}
        {line_xml}
      </p:spPr>
      <p:txBody>
        <a:bodyPr wrap="square" anchor="{anchor}" lIns="{margin*12700}" tIns="{margin*12700}" rIns="{margin*12700}" bIns="{margin*12700}"/>
        <a:lstStyle/>
        {body}
      </p:txBody>
    </p:sp>
    """


def picture(rid: str, x: float, y: float, w: float, h: float) -> str:
    return f"""
    <p:pic>
      <p:nvPicPr>
        <p:cNvPr id="0" name="Picture"/>
        <p:cNvPicPr/>
        <p:nvPr/>
      </p:nvPicPr>
      <p:blipFill>
        <a:blip r:embed="{rid}"/>
        <a:stretch><a:fillRect/></a:stretch>
      </p:blipFill>
      <p:spPr>
        <a:xfrm><a:off x="{inches(x)}" y="{inches(y)}"/><a:ext cx="{inches(w)}" cy="{inches(h)}"/></a:xfrm>
        <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
      </p:spPr>
    </p:pic>
    """


def slide_xml(elements: Iterable[str]) -> str:
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
 xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld><p:spTree>
    <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
    <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
    {''.join(elements)}
  </p:spTree></p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>"""


def content_types(slide_count: int) -> str:
    slide_overrides = "\n".join(
        [f'<Override PartName="/ppt/slides/slide{i}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>' for i in range(1, slide_count + 1)]
    )
    rels_overrides = "\n".join(
        [f'<Relationship Id="rId{i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide{i}.xml"/>' for i in range(1, slide_count + 1)]
    )
    return slide_overrides, rels_overrides


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    if OUT_FILE.exists():
        OUT_FILE.unlink()

    logo_x_w, logo_x_h = image_size(LOGO_XINGU)
    logo_i_w, logo_i_h = image_size(LOGO_ILUMINA)
    telas_w, telas_h = image_size(TELAS)

    slides: list[tuple[str, list[tuple[str, str]]]] = []

    slides.append((
        "capa",
        [
            ("bg", text_box(0, 0, SLIDE_W, SLIDE_H, "", fill="F6F1E8")),
            ("band", text_box(0, 0, SLIDE_W, 1.1, "", fill="17324A")),
            ("accent", text_box(0, 1.1, SLIDE_W, 0.15, "", fill="F28C28")),
            ("title", text_box(0.8, 1.6, 6.8, 1.2, "IluminaXingu", size=30, bold=True, color="17324A")),
            ("sub", text_box(0.8, 2.62, 7.2, 0.8, "Sistema digital de gestao da iluminacao publica", size=19, color="F28C28", bold=True)),
            ("desc", text_box(0.8, 3.28, 7.8, 1.2, "Versao executiva para apresentacao ao prefeito e ao secretario de administracao", size=20, color="2F3B45")),
            ("box", text_box(0.8, 4.9, 5.8, 1.15, "Agora com painel administrativo que mostra postes reparados, equipe responsavel, ordem de servico e data de atendimento.", size=16, color="17324A", fill="FFFFFF", line="D9D2C7", radius=True)),
            ("logo1", picture("rId1", 9.15, 1.0, 3.4, 1.15)),
            ("logo2", picture("rId2", 9.15, 5.35, 3.0, 1.15)),
        ],
    ))

    slides.append((
        "resumo",
        [
            ("bg", text_box(0, 0, SLIDE_W, SLIDE_H, "", fill="FFFFFF")),
            ("top", text_box(0, 0, SLIDE_W, 0.65, "", fill="17324A")),
            ("accent", text_box(0, 0.65, SLIDE_W, 0.12, "", fill="F28C28")),
            ("h1", text_box(0.7, 0.95, 6.6, 0.5, "Resumo executivo", size=24, bold=True, color="17324A")),
            ("k1", text_box(0.7, 1.65, 3.8, 1.15, "Atendimento digital", size=19, bold=True, color="17324A", fill="F6F1E8", line="E7D9C7", radius=True)),
            ("k1t", text_box(0.9, 2.0, 3.3, 0.65, "O municipe registra o problema pelo celular, com foto e localizacao.", size=15, color="2F3B45")),
            ("k2", text_box(4.7, 1.65, 3.8, 1.15, "Controle operacional", size=19, bold=True, color="17324A", fill="F6F1E8", line="E7D9C7", radius=True)),
            ("k2t", text_box(4.9, 2.0, 3.3, 0.65, "A prefeitura acompanha fila, prioridades, OS e historico.", size=15, color="2F3B45")),
            ("k3", text_box(8.7, 1.65, 3.8, 1.15, "Transparencia", size=19, bold=True, color="17324A", fill="F6F1E8", line="E7D9C7", radius=True)),
            ("k3t", text_box(8.9, 2.0, 3.2, 0.65, "O novo painel mostra poste reparado, equipe, OS e data.", size=15, color="2F3B45")),
            ("mid", text_box(0.7, 3.55, 12.0, 0.55, "Mensagem principal: transformar chamadas soltas em dados organizados, rastreaveis e uteis para decisao.", size=18, bold=True, color="F28C28")),
            ("bul", text_box(0.9, 4.28, 11.5, 1.75, "• localizacao precisa\n• ordens de servico rastreaveis\n• acompanhamento por equipe\n• historico territorial dos postes", size=16, color="17324A")),
        ],
    ))

    slides.append((
        "solucao",
        [
            ("bg", text_box(0, 0, SLIDE_W, SLIDE_H, "", fill="F7F7F4")),
            ("head", text_box(0.55, 0.55, 12.0, 0.45, "Como o sistema organiza o atendimento", size=24, bold=True, color="17324A")),
            ("c1", text_box(0.7, 1.5, 2.8, 1.6, "1\nMunicipe registra a demanda\nfoto, descricao e GPS", size=18, bold=True, color="FFFFFF", fill="17324A", radius=True, align="center", valign="mid")),
            ("c2", text_box(3.8, 1.5, 2.8, 1.6, "2\nPrefeitura prioriza e gera OS\nfila, status e responsavel", size=18, bold=True, color="FFFFFF", fill="355C7D", radius=True, align="center", valign="mid")),
            ("c3", text_box(6.9, 1.5, 2.8, 1.6, "3\nEquipe executa no local\nrota, poste e atendimento", size=18, bold=True, color="FFFFFF", fill="F28C28", radius=True, align="center", valign="mid")),
            ("c4", text_box(10.0, 1.5, 2.6, 1.6, "4\nHistorico fica salvo\npara controle e auditoria", size=18, bold=True, color="FFFFFF", fill="6B7A8F", radius=True, align="center", valign="mid")),
            ("bar", text_box(1.0, 3.55, 11.3, 0.45, "Fluxo simples para usar em fala: demanda -> OS -> execução -> historico", size=17, bold=True, color="17324A", fill="FFFFFF", line="D9D9D9", radius=True, align="center")),
            ("txt", text_box(0.9, 4.35, 11.8, 1.6, "A prefeitura deixa de lidar com reclamacoes dispersas e passa a operar com fila, prioridade, responsavel e evidencias do servico executado.", size=17, color="2F3B45")),
        ],
    ))

    slides.append((
        "painel",
        [
            ("bg", text_box(0, 0, SLIDE_W, SLIDE_H, "", fill="FFFFFF")),
            ("head", text_box(0.55, 0.45, 12.0, 0.45, "Novo destaque no painel administrativo", size=24, bold=True, color="17324A")),
            ("sub", text_box(0.55, 0.9, 11.4, 0.35, "Agora a prefeitura enxerga, de forma objetiva, quais postes foram reparados e por quem.", size=16, color="F28C28", bold=True)),
            ("imgbox", text_box(0.55, 1.35, 7.0, 5.7, "", fill="F7F7F4", line="D9D9D9", radius=True)),
            ("img", picture("rId1", 0.9, 1.68, 6.3, 5.0)),
            ("card1", text_box(7.9, 1.55, 4.7, 1.15, "Poste reparado\nMostra o status de conclusao com clareza para a gestao.", size=16, bold=True, color="17324A", fill="F6F1E8", line="E7D9C7", radius=True)),
            ("card2", text_box(7.9, 2.9, 4.7, 1.15, "Equipe responsavel\nIdentifica qual equipe executou o atendimento.", size=16, bold=True, color="17324A", fill="F6F1E8", line="E7D9C7", radius=True)),
            ("card3", text_box(7.9, 4.25, 4.7, 1.15, "Ordem de servico\nVincula o servico a uma OS especifica.", size=16, bold=True, color="17324A", fill="F6F1E8", line="E7D9C7", radius=True)),
            ("card4", text_box(7.9, 5.6, 4.7, 1.15, "Data de atendimento\nPermite acompanhar prazo, produtividade e historico.", size=16, bold=True, color="17324A", fill="F6F1E8", line="E7D9C7", radius=True)),
        ],
    ))

    slides.append((
        "telas",
        [
            ("bg", text_box(0, 0, SLIDE_W, SLIDE_H, "", fill="F7F7F4")),
            ("head", text_box(0.55, 0.45, 12.0, 0.45, "Telas para demonstracao", size=24, bold=True, color="17324A")),
            ("sub", text_box(0.55, 0.9, 11.4, 0.35, "Use esta tela para mostrar a experiencia do cidadao e o dashboard da prefeitura.", size=15, color="6B7280")),
            ("imgframe", text_box(0.55, 1.35, 12.2, 5.6, "", fill="FFFFFF", line="D9D9D9", radius=True)),
            ("img", picture("rId1", 0.75, 1.62, 11.8, 5.08)),
        ],
    ))

    slides.append((
        "operacao",
        [
            ("bg", text_box(0, 0, SLIDE_W, SLIDE_H, "", fill="17324A")),
            ("head", text_box(0.55, 0.45, 12.0, 0.45, "Fluxo operacional recomendado", size=24, bold=True, color="FFFFFF")),
            ("line1", text_box(0.8, 1.3, 12.0, 0.45, "1. Municipe abre a solicitacao e envia foto + GPS.", size=17, color="FFFFFF")),
            ("line2", text_box(0.8, 1.95, 12.0, 0.45, "2. Sistema gera protocolo e entra na fila de atendimento.", size=17, color="FFFFFF")),
            ("line3", text_box(0.8, 2.6, 12.0, 0.45, "3. Prefeitura analisa, prioriza e cria a ordem de servico.", size=17, color="FFFFFF")),
            ("line4", text_box(0.8, 3.25, 12.0, 0.45, "4. Equipe vai ao local, executa o atendimento e registra a conclusao.", size=17, color="FFFFFF")),
            ("line5", text_box(0.8, 3.9, 12.0, 0.45, "5. Painel administrativo consolida poste reparado, equipe, OS e data.", size=17, color="FFFFFF")),
            ("box", text_box(0.8, 5.0, 11.8, 1.1, "Esse fluxo facilita controle operacional, reduz retrabalho e deixa a gestao mais transparente para auditoria interna.", size=17, color="17324A", fill="F6F1E8", line="F6F1E8", radius=True, align="center", valign="mid")),
        ],
    ))

    slides.append((
        "seguranca",
        [
            ("bg", text_box(0, 0, SLIDE_W, SLIDE_H, "", fill="FFFFFF")),
            ("head", text_box(0.55, 0.45, 12.0, 0.45, "Governanca, transparencia e confiabilidade", size=24, bold=True, color="17324A")),
            ("left", text_box(0.7, 1.35, 5.8, 4.9, "• acesso separado para municipe e prefeitura\n• login e perfis administrativos\n• rotas protegidas para funcoes sensiveis\n• aceite LGPD no formulario publico\n• historico e auditoria de alteracoes\n• dados estruturados por bairro, rua e poste", size=18, color="2F3B45")),
            ("right", text_box(7.0, 1.35, 5.6, 4.9, "O valor para a prefeitura nao e apenas atender mais rapido. E conseguir provar o que foi feito, por quem foi feito e em que data foi feito.", size=20, bold=True, color="F28C28", fill="F6F1E8", line="E7D9C7", radius=True, align="center", valign="mid")),
        ],
    ))

    slides.append((
        "fechamento",
        [
            ("bg", text_box(0, 0, SLIDE_W, SLIDE_H, "", fill="F6F1E8")),
            ("band", text_box(0, 0, 13.333, 0.95, "", fill="17324A")),
            ("accent", text_box(0, 0.95, 13.333, 0.12, "", fill="F28C28")),
            ("title", text_box(0.9, 1.45, 11.5, 0.55, "IluminaXingu", size=28, bold=True, color="17324A")),
            ("sum", text_box(0.9, 2.1, 11.4, 1.05, "Uma plataforma para organizar a iluminacao publica, dar visibilidade ao trabalho das equipes e ampliar a transparencia perante a prefeitura.", size=19, color="2F3B45")),
            ("cta", text_box(0.9, 3.7, 5.7, 1.0, "Pronto para apresentar ao prefeito e ao secretario.", size=20, bold=True, color="FFFFFF", fill="F28C28", radius=True, align="center", valign="mid")),
            ("logo1", picture("rId1", 8.95, 1.15, 3.5, 1.1)),
            ("logo2", picture("rId2", 9.15, 5.35, 2.95, 1.1)),
        ],
    ))

    slide_count = len(slides)
    slide_overrides, rels_overrides = content_types(slide_count)

    with zipfile.ZipFile(OUT_FILE, "w", compression=zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/_rels/presentation.xml.rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideMasters/_rels/slideMaster1.xml.rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/slideLayouts/_rels/slideLayout1.xml.rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  {slide_overrides}
</Types>""")
        z.writestr("_rels/.rels", """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>""")
        z.writestr("ppt/presentation.xml", f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
 xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
  <p:sldIdLst>
    {"".join([f'<p:sldId id="{256+i}" r:id="rId{i+2}"/>' for i in range(slide_count)])}
  </p:sldIdLst>
  <p:slideSize cx="{inches(SLIDE_W)}" cy="{inches(SLIDE_H)}"/>
  <p:notesSize cx="6858000" cy="9144000"/>
</p:presentation>""")
        z.writestr("ppt/_rels/presentation.xml.rels", f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
  {rels_overrides}
</Relationships>""")

        z.writestr("ppt/slideMasters/slideMaster1.xml", """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
 xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld><p:spTree>
    <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
    <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
  </p:spTree></p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
  <p:sldLayoutIdLst><p:sldLayoutId id="1" r:id="rId1"/></p:sldLayoutIdLst>
</p:sldMaster>""")
        z.writestr("ppt/slideMasters/_rels/slideMaster1.xml.rels", """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>""")
        z.writestr("ppt/slideLayouts/slideLayout1.xml", """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
 xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" type="blank" preserve="1">
  <p:cSld><p:spTree>
    <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
    <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
  </p:spTree></p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>""")
        z.writestr("ppt/slideLayouts/_rels/slideLayout1.xml.rels", """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>""")

        # Media
        media_map = {
            "image1.png": TELAS,
            "image2.png": LOGO_XINGU,
            "image3.png": LOGO_ILUMINA,
        }
        for name, path in media_map.items():
            z.write(path, f"ppt/media/{name}")

        for i, (_, elements) in enumerate(slides, start=1):
            rels = [
                f'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/>'
            ]
            if any("rId2" in e for e in elements):
                rels.append(
                    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image2.png"/>'
                )
            if any("rId3" in e for e in elements):
                rels.append(
                    '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image3.png"/>'
                )
            # Ensure both logos can be reused via rId1/rId2.
            rels = [
                '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image2.png"/>',
                '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image3.png"/>',
                '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/>',
            ]
            # Remap picture refs per slide.
            slide_text = slide_xml(elements)
            slide_text = slide_text.replace('r:embed="rId1"', 'r:embed="rId1"')
            slide_text = slide_text.replace('r:embed="rId2"', 'r:embed="rId2"')
            slide_text = slide_text.replace('r:embed="rId3"', 'r:embed="rId3"')
            z.writestr(f"ppt/slides/slide{i}.xml", slide_text)
            z.writestr(
                f"ppt/slides/_rels/slide{i}.xml.rels",
                f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  {"".join(rels)}
</Relationships>""",
            )

        # Minimal theme
        z.writestr("ppt/theme/theme1.xml", """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office Theme">
  <a:themeElements>
    <a:clrScheme name="Office">
      <a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>
      <a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>
      <a:dk2><a:srgbClr val="17324A"/></a:dk2>
      <a:lt2><a:srgbClr val="F6F1E8"/></a:lt2>
      <a:accent1><a:srgbClr val="F28C28"/></a:accent1>
      <a:accent2><a:srgbClr val="355C7D"/></a:accent2>
      <a:accent3><a:srgbClr val="6B7A8F"/></a:accent3>
      <a:accent4><a:srgbClr val="E7D9C7"/></a:accent4>
      <a:accent5><a:srgbClr val="2F3B45"/></a:accent5>
      <a:accent6><a:srgbClr val="F7F7F4"/></a:accent6>
      <a:hlink><a:srgbClr val="0563C1"/></a:hlink>
      <a:folHlink><a:srgbClr val="954F72"/></a:folHlink>
    </a:clrScheme>
    <a:fontScheme name="Office">
      <a:majorFont><a:latin typeface="Aptos"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>
      <a:minorFont><a:latin typeface="Aptos"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont>
    </a:fontScheme>
    <a:fmtScheme name="Office">
      <a:fillStyleLst/>
      <a:lnStyleLst/>
      <a:effectStyleLst/>
      <a:bgFillStyleLst/>
    </a:fmtScheme>
  </a:themeElements>
</a:theme>""")

    print(f"created {OUT_FILE}")


if __name__ == "__main__":
    main()
