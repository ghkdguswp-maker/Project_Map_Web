/**
 * AI Prompt Specification Exporter
 * - Converts canvas structure to standardized ai_prompt_spec.md
 * - Generates auto Mermaid diagram, module specs, DB schemas, and actionable checklists
 */

class AiPromptExporter {
  static generateSpec(projectData) {
    const rootBoard = projectData.boards['root'] || Object.values(projectData.boards)[0];
    const timestamp = new Date().toISOString();

    let md = `# 🚀 [AI 작업 지시서] ${projectData.project_name || '프로젝트 맵 아키텍처'}\n`;
    md += `> **생성 일시**: ${timestamp}  \n`;
    md += `> **문서 버전**: v1.0 (Project Map Auto-Generated Spec)  \n`;
    md += `> **대상 AI**: Antigravity, OpenAI GPT, Claude, 어딧노 로컬 AI  \n\n`;

    md += `---\n\n`;
    md += `## 📌 1. 프로젝트 개요\n`;
    md += `본 문서는 **프로젝트 맵(Project Map)** 사령탑에서 시각적으로 기획된 아키텍처 및 세부 모듈 사양서입니다.\n`;
    md += `담당 AI는 아래 기술된 아키텍처, 데이터 흐름, DB 스키마, 및 체크리스트를 준수하여 구현 작업을 완수해야 합니다.\n\n`;

    // 2. Mermaid 아키텍처 다이어그램
    md += `## 🏗️ 2. 시스템 아키텍처 흐름도 (Mermaid Diagram)\n\n`;
    md += `\`\`\`mermaid\ngraph TD\n`;

    // 모든 보드의 노드 및 엣지 수집
    Object.values(projectData.boards).forEach(board => {
      board.nodes.forEach(node => {
        const cleanTitle = (node.title || node.id).replace(/["`\[\]()]/g, ' ').trim();
        md += `    ${node.id}["${cleanTitle}"]\n`;
      });
      board.edges.forEach(edge => {
        const labelStr = edge.label ? `|${edge.label.replace(/["|]/g, '')}|` : '';
        md += `    ${edge.from} -->${labelStr} ${edge.to}\n`;
      });
    });
    md += `\`\`\`\n\n`;

    // 3. 모듈별 상세 사양
    md += `## 📦 3. 핵심 모듈 및 컴포넌트 상세 사양\n\n`;
    Object.values(projectData.boards).forEach(board => {
      md += `### 📂 [보드: ${board.title}]\n\n`;

      board.nodes.forEach(node => {
        md += `#### 🔹 [${node.title || node.id}]\n`;
        md += `- **노드 ID**: \`${node.id}\`\n`;
        md += `- **분류 (Category)**: \`${node.category || 'general'}\`\n`;
        md += `- **진행 상태 (Status)**: \`${node.status || 'planned'}\`\n`;
        if (node.tags && node.tags.length > 0) {
          md += `- **태그**: ${node.tags.map(t => `\`#${t}\``).join(' ')}\n`;
        }
        md += `- **설명**: ${node.description || '상세 설명 없음'}\n`;

        // 노드 타입별 추가 정보
        if (node.type === 'checklist' && node.data && node.data.items) {
          md += `\n**📋 구현 체크리스트:**\n`;
          node.data.items.forEach(it => {
            md += `- [${it.done ? 'x' : ' '}] ${it.text}\n`;
          });
        }

        if (node.type === 'db_schema' && node.data) {
          md += `\n**💾 데이터베이스 스키마 (\`${node.data.table_name || 'table'}\`):**\n`;
          md += `| 필드명 | 데이터 타입 | 설명 |\n| --- | --- | --- |\n`;
          (node.data.columns || []).forEach(col => {
            md += `| \`${col.name}\` | \`${col.type}\` | - |\n`;
          });
        }

        if (node.type === 'markdown' && node.data && node.data.content) {
          md += `\n**📝 기술 메모 / 스펙 세부내용:**\n\n${node.data.content}\n`;
        }

        md += `\n`;
      });
    });

    // 4. AI 에이전트 액션 가이드
    md += `---\n\n`;
    md += `## 🤖 4. AI 개발 에이전트 작업 지침 (System Instruction)\n`;
    md += `1. **코드 구현 시 원칙**: 상기 기술된 노드 간 데이터 흐름 화살표의 입출력 규격을 반드시 유지할 것.\n`;
    md += `2. **체크리스트 우선순위**: 미완료 항목(\`[ ]\`)을 우선순위 순서대로 즉각 코딩 및 테스트 완료할 것.\n`;
    md += `3. **DB 무결성**: 정의된 테이블 스키마의 타입과 PK 제약 조건을 100% 충족하도록 모델링할 것.\n`;

    return md;
  }
}
