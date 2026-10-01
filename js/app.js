/**
 * Project Map Main Controller (v3.0 - 2D / 3D Hybrid Architecture)
 */

class ProjectMapApp {
  constructor() {
    this.projectData = {
      version: '1.0.0',
      project_name: '신규 프로젝트 맵',
      active_board_id: 'root',
      boards: {
        root: {
          id: 'root',
          title: '어딧노 종합 관제 맵',
          viewport: { x: 0, y: 0, zoom: 1.0 },
          nodes: [],
          edges: []
        }
      }
    };

    this.backend = null;
    this.autoSaveTimeout = null;
    this.editingNode = null;
    this.is3DMode = true; // 기본 3D 활성화

    this.initDOM();
    this.initEngines();
    this.initBridge();
    this.initShortcuts();
  }

  initDOM() {
    this.canvas2DWrapper = document.getElementById('canvas-wrapper');
    this.canvas2DEl = document.getElementById('main-canvas');
    this.minimap2DEl = document.getElementById('minimap-canvas');
    this.minimapContainer = document.getElementById('minimap-container');

    this.canvas3DContainer = document.getElementById('canvas-3d-container');
    this.radarCanvasEl = document.getElementById('radar-canvas');
    this.radarContainer = document.getElementById('radar-container');

    this.toastEl = document.getElementById('toast');
    this.modeBadgeEl = document.getElementById('view-mode-badge');
    this.nodeCountEl = document.getElementById('hud-node-count');
    this.edgeCountEl = document.getElementById('hud-edge-count');
    this.saveStatusEl = document.getElementById('save-status-indicator');

    // 모달
    this.aiModalEl = document.getElementById('ai-spec-modal');
    this.nodeModalEl = document.getElementById('node-edit-modal');
    this.aiSpecTextarea = document.getElementById('ai-spec-content');

    // 어딧노 AI 연동 모달
    this.aiChatModalEl = document.getElementById('ai-chat-modal');
    this.aiConnStatusEl = document.getElementById('ai-conn-status');
    this.aiChatResponseEl = document.getElementById('ai-chat-response');
    this.aiPromptInputEl = document.getElementById('ai-prompt-input');
    this.aiSendBtnEl = document.getElementById('ai-send-btn');
  }

  initEngines() {
    // 2D 엔진 초기화
    this.engine2D = new CanvasEngine(this.canvas2DEl, this.minimap2DEl);
    this.drillDown = new DrillDownManager(this.projectData, (board) => {
      this.syncActiveBoard();
    });

    // 3D 엔진 초기화
    this.engine3D = new Canvas3DEngine(this.canvas3DContainer, this.radarCanvasEl);

    // 이벤트 리스너
    this.engine2D.onDataChange = () => this.triggerAutoSave();
    this.engine2D.onNodeDoubleClick = (node) => this.drillDown.enterSubBoard(node);
    this.engine2D.onNodeClick = () => this.updateHud();

    this.engine3D.onNodeClick = (node) => {
      this.selectedNodeId = node.id;
      this.updateHud();
    };

    this.engine3D.onNodeDoubleClick = (node) => {
      this.drillDown.enterSubBoard(node);
    };

    // 초기 표시 모드 설정
    this.setDimensionMode(this.is3DMode);
  }

  // 2D ⇄ 3D 모드 전환
  toggleDimensionMode() {
    this.setDimensionMode(!this.is3DMode);
    this.showToast(this.is3DMode ? '🌌 3D 공간 타워 모드로 전환 (Tab)' : '📐 2D 평면 워크스페이스 모드로 전환 (Tab)');
  }

  setDimensionMode(is3D) {
    this.is3DMode = is3D;
    const currentBoard = this.drillDown.getCurrentBoard();

    if (this.is3DMode) {
      this.canvas2DWrapper.style.display = 'none';
      this.canvas3DContainer.style.display = 'block';
      this.minimapContainer.style.display = 'none';
      this.radarContainer.style.display = 'flex';
      if (this.modeBadgeEl) this.modeBadgeEl.textContent = '🌌 3D TOWER';
      this.engine3D.setData(currentBoard.nodes, currentBoard.edges);
      this.engine3D.onWindowResize();
    } else {
      this.canvas2DWrapper.style.display = 'block';
      this.canvas3DContainer.style.display = 'none';
      this.minimapContainer.style.display = 'block';
      this.radarContainer.style.display = 'none';
      if (this.modeBadgeEl) this.modeBadgeEl.textContent = '📐 2D PLANE';
      this.engine2D.setData(currentBoard.nodes, currentBoard.edges, currentBoard.viewport);
      this.engine2D.resizeCanvas();
    }
    this.updateHud();
  }

  syncActiveBoard() {
    const board = this.drillDown.getCurrentBoard();
    if (this.is3DMode) {
      this.engine3D.setData(board.nodes, board.edges);
    } else {
      this.engine2D.setData(board.nodes, board.edges, board.viewport);
    }
    this.updateHud();
  }

  initBridge() {
    if (typeof QWebChannel !== 'undefined') {
      try {
        new QWebChannel(qt.webChannelTransport, (channel) => {
          this.backend = channel.objects.backend;
          this.loadFromBackend();
          if (this.backend.cloudStatus) {
            this.backend.cloudStatus.connect((msg) => {
              this.showToast(msg);
            });
          }
          if (this.backend.statusMessage) {
            this.backend.statusMessage.connect((msg) => {
              this.showToast(msg);
            });
          }
        });
      } catch (e) {
        this.loadFromLocalStorage();
      }
    } else {
      this.loadFromLocalStorage();
    }
  }

  loadFromBackend() {
    if (this.backend) {
      this.backend.loadProjectData((jsonStr) => {
        if (jsonStr && jsonStr !== '{}') {
          try {
            this.projectData = JSON.parse(jsonStr);
            this.drillDown.projectData = this.projectData;
            this.drillDown.renderBreadcrumb();
            this.syncActiveBoard();
            this.showToast('프로젝트 데이터를 불러왔습니다');
          } catch (e) {
            console.error('JSON parse error:', e);
          }
        }
      });
    }
  }

  loadFromLocalStorage() {
    // 1. 태블릿 환경: PC REST API (/api/load)로부터 최신 데이터 우선 조회
    fetch('/api/load')
      .then(res => res.json())
      .then(data => {
        if (data && data.boards) {
          this.projectData = data;
          this.drillDown.projectData = this.projectData;
          this.drillDown.renderBreadcrumb();
          this.syncActiveBoard();
          localStorage.setItem('project_map_data', JSON.stringify(data));
          this.showToast('PC와 실시간 연결되었습니다 🟢');

          // PC 설정(/api/info) 가져와서 Gist 토큰 로컬 캐시 (PC 꺼짐 대비)
          fetch('/api/info').then(r => r.json()).then(info => {
            if (info.token) localStorage.setItem('github_token', info.token);
            if (info.gist_id) localStorage.setItem('github_gist_id', info.gist_id);
          }).catch(() => {});
          return;
        }
        throw new Error('Invalid data');
      })
      .catch(() => {
        // 2. PC 서버 오프라인일 때: localStorage 캐시에서 불러오기
        const saved = localStorage.getItem('project_map_data');
        if (saved) {
          try {
            this.projectData = JSON.parse(saved);
            this.drillDown.projectData = this.projectData;
            this.drillDown.renderBreadcrumb();
            this.syncActiveBoard();
            this.showToast('오프라인 캐시 맵을 불러왔습니다');
            return;
          } catch (e) {}
        }

        // 3. 기본 정적 파일 로드
        fetch('../project_map.json')
          .then(res => res.json())
          .then(data => {
            this.projectData = data;
            this.drillDown.projectData = this.projectData;
            this.drillDown.renderBreadcrumb();
            this.syncActiveBoard();
          })
          .catch(() => {
            this.drillDown.renderBreadcrumb();
            this.syncActiveBoard();
          });
      });
  }

  triggerAutoSave() {
    const currentBoard = this.drillDown.getCurrentBoard();
    if (!this.is3DMode) {
      currentBoard.viewport = { ...this.engine2D.viewport };
      currentBoard.nodes = this.engine2D.nodes;
      currentBoard.edges = this.engine2D.edges;
    }
    this.projectData.last_updated = new Date().toISOString();

    if (this.saveStatusEl) {
      this.saveStatusEl.innerHTML = '<span class="status-dot" style="background:#f59e0b; box-shadow:0 0 8px #f59e0b"></span> 저장 중...';
    }

    clearTimeout(this.autoSaveTimeout);
    this.autoSaveTimeout = setTimeout(() => {
      this.saveData();
    }, 600);
  }

  saveData() {
    const jsonStr = JSON.stringify(this.projectData, null, 2);
    localStorage.setItem('project_map_data', jsonStr);

    if (this.backend) {
      this.backend.saveProjectData(jsonStr, () => {
        if (this.saveStatusEl) {
          this.saveStatusEl.innerHTML = '<span class="status-dot"></span> 자동 저장됨';
        }
      });
    } else {
      // 태블릿(브라우저/PWA) 환경: PC REST API로 전송 시도
      fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: jsonStr
      })
      .then(res => res.json())
      .then(data => {
        if (this.saveStatusEl) {
          this.saveStatusEl.innerHTML = '<span class="status-dot"></span> PC & 클라우드 저장됨 ☁️';
        }
        this.showToast('PC & 깃허브 클라우드 동기화 완료!');
      })
      .catch(err => {
        console.warn('PC API unreachable, attempting direct GitHub Gist sync...', err);
        // PC가 꺼져 있거나 외부 네트워크일 때: GitHub Gist 직접 저장 시도
        this.saveDirectToGist(jsonStr);
      });
    }
  }

  saveDirectToGist(jsonStr) {
    const gistId = 'ae7308ef42acff6bf6a243956a111bc0';
    const token = localStorage.getItem('github_token') || '';

    if (!token) {
      if (this.saveStatusEl) {
        this.saveStatusEl.innerHTML = '<span class="status-dot" style="background:#38bdf8"></span> 태블릿 오프라인 저장됨';
      }
      return;
    }

    fetch(`https://api.github.com/gists/${gistId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        description: 'Eoditno Project Map Cloud Database (Private)',
        files: { 'project_map.json': { content: jsonStr } }
      })
    })
    .then(r => r.json())
    .then(res => {
      if (this.saveStatusEl) {
        this.saveStatusEl.innerHTML = '<span class="status-dot"></span> 깃허브 Gist 직접 저장됨 ☁️';
      }
      this.showToast('PC 전원 꺼짐 감지: GitHub 클라우드 직접 저장 완료!');
    })
    .catch(e => {
      if (this.saveStatusEl) {
        this.saveStatusEl.innerHTML = '<span class="status-dot" style="background:#38bdf8"></span> 태블릿 로컬 저장됨';
      }
    });
  }

  // 3D 노드 내부 체크리스트 토글
  toggleChecklistItem(nodeId, itemIdx) {
    const currentBoard = this.drillDown.getCurrentBoard();
    const node = currentBoard.nodes.find(n => n.id === nodeId);
    if (node && node.data && node.data.items && node.data.items[itemIdx]) {
      node.data.items[itemIdx].done = !node.data.items[itemIdx].done;
      this.syncActiveBoard();
      this.triggerAutoSave();
    }
  }

  updateHud() {
    const currentBoard = this.drillDown.getCurrentBoard();
    if (this.nodeCountEl) this.nodeCountEl.textContent = `노드: ${currentBoard.nodes.length}개`;
    if (this.edgeCountEl) this.edgeCountEl.textContent = `연결: ${currentBoard.edges.length}개`;
  }

  showToast(msg) {
    if (!this.toastEl) return;
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('show');
    setTimeout(() => {
      this.toastEl.classList.remove('show');
    }, 2500);
  }

  // 노드 추가
  createNode(type = 'standard') {
    const currentBoard = this.drillDown.getCurrentBoard();
    const id = `node_${Date.now()}`;

    let category = 'core';
    let title = '신규 시스템 노드';
    let height = 180;
    let data = {};

    if (type === 'checklist') {
      category = 'backend';
      title = '📋 개발 체크리스트';
      height = 220;
      data = {
        items: [
          { text: '인터페이스 설계 및 API 규격 정의', done: false },
          { text: '핵심 모듈 구현 및 유닛 테스트', done: false }
        ]
      };
    } else if (type === 'db_schema') {
      category = 'database';
      title = '💾 데이터베이스 테이블';
      height = 240;
      data = {
        table_name: 'new_table',
        columns: [
          { name: 'id', type: 'INTEGER PRIMARY KEY' },
          { name: 'status', type: 'VARCHAR(50)' }
        ]
      };
    } else if (type === 'markdown') {
      category = 'ai';
      title = '📝 AI 프롬프트 명세';
      height = 200;
      data = { content: "### 💡 개발 메모\n- 구현 가이드: ..." };
    }

    // 3D 층별 Z값 자동 계산
    const layerInfo = this.engine3D.layers[category] || { z: 0 };

    const newNode = {
      id: id,
      type: type,
      title: title,
      description: '새로운 시스템 컴포넌트 사양',
      category: category,
      status: 'planned',
      tags: ['new'],
      x: 300 + Math.random() * 200,
      y: 200 + Math.random() * 200,
      z: layerInfo.z,
      width: 320,
      height: height,
      sub_board_id: null,
      data: data
    };

    currentBoard.nodes.push(newNode);
    this.syncActiveBoard();
    this.triggerAutoSave();
    this.showToast('새 노드가 생성되었습니다');
  }

  deleteSelectedNode() {
    const currentBoard = this.drillDown.getCurrentBoard();
    const targetId = this.is3DMode ? this.engine3D.selectedNodeId : Array.from(this.engine2D.selectedNodeIds)[0];

    if (!targetId) {
      this.showToast('삭제할 노드를 먼저 선택하세요');
      return;
    }

    currentBoard.nodes = currentBoard.nodes.filter(n => n.id !== targetId);
    currentBoard.edges = currentBoard.edges.filter(e => e.from !== targetId && e.to !== targetId);

    this.syncActiveBoard();
    this.triggerAutoSave();
    this.showToast('노드가 삭제되었습니다');
  }

  openAiSpecModal() {
    const specMd = AiPromptExporter.generateSpec(this.projectData);
    this.aiSpecTextarea.value = specMd;
    this.aiModalEl.classList.add('active');
    if (this.backend) this.backend.exportAiPromptSpec(specMd, () => {});
  }

  closeAiSpecModal() {
    this.aiModalEl.classList.remove('active');
  }

  copyAiSpecToClipboard() {
    this.aiSpecTextarea.select();
    navigator.clipboard.writeText(this.aiSpecTextarea.value).then(() => {
      this.showToast('클립보드에 복사 완료!');
    });
  }

  saveAiSpecFile() {
    const specMd = this.aiSpecTextarea.value;
    if (this.backend) {
      this.backend.exportAiPromptSpec(specMd, () => {
        this.showToast('ai_prompt_spec.md 파일 저장 완료');
      });
    }
  }

  // 어딧노 AI 연동 모달 제어
  updateAiConnStatus(status) {
    if (!this.aiConnStatusEl) return;
    if (status === 'ONLINE' || status === 'READY') {
      this.aiConnStatusEl.textContent = '🟢 AI 사령탑 온라인';
      this.aiConnStatusEl.style.color = '#34d399';
    } else {
      this.aiConnStatusEl.textContent = '⚪ AI 대기중';
      this.aiConnStatusEl.style.color = '#94a3b8';
    }
  }

  openAiChatModal() {
    if (!this.aiChatModalEl) return;
    this.aiChatModalEl.classList.add('active');
    if (this.backend && this.backend.checkAiStatus) {
      this.backend.checkAiStatus((status) => this.updateAiConnStatus(status));
    }
    if (this.aiPromptInputEl) {
      setTimeout(() => this.aiPromptInputEl.focus(), 100);
    }
  }

  closeAiChatModal() {
    if (this.aiChatModalEl) {
      this.aiChatModalEl.classList.remove('active');
    }
  }

  sendAiQuickPrompt(type) {
    let prompt = "";
    if (type === 'analyze_all') {
      prompt = "프로젝트 맵의 전체 컴포넌트 구조 및 5대 핵심 노드의 상태를 분석하고 요약 브리핑해줘.";
    } else if (type === 'check_progress') {
      prompt = "프로젝트 맵의 체크리스트 항목 현황을 점검하고 미완료 항목과 우선순위를 알려줘.";
    } else if (type === 'suggest_next') {
      prompt = "현재 프로젝트 맵 진행 상태(진행중/활성 노드)를 고려할 때 다음에 우선적으로 구현해야 할 기능과 세부 설계를 제안해줘.";
    } else if (type === 'sync_and_review') {
      prompt = "프로젝트 맵의 최신 캔버스 명세서를 바탕으로 시스템 아키텍처 및 DB 스키마 무결성을 검토해줘.";
    }
    if (prompt) {
      if (this.aiPromptInputEl) this.aiPromptInputEl.value = prompt;
      this.executeAiQuery(prompt);
    }
  }

  sendAiPrompt() {
    if (!this.aiPromptInputEl) return;
    const query = this.aiPromptInputEl.value.trim();
    if (!query) return;
    this.executeAiQuery(query);
  }

  executeAiQuery(prompt) {
    if (!this.backend || !this.backend.askEoditnoAi) {
      this.aiChatResponseEl.textContent = "⚠️ [안내] 어딧노 AI 코어 백엔드 브리지가 연결되지 않았습니다. Python 데스크톱 환경에서 실행해 주세요.";
      return;
    }

    this.aiChatResponseEl.textContent = `⏳ [어딧노 AI 사령탑 분석 중...]\n\n마스터의 지시: "${prompt}"\n\nAI_Core 엔진 및 전담 도구(manage_project_map)와 통신하고 있습니다. 잠시만 기다려 주세요...`;
    if (this.aiSendBtnEl) {
      this.aiSendBtnEl.disabled = true;
      this.aiSendBtnEl.textContent = "분석중...";
    }

    this.backend.askEoditnoAi(prompt, (response) => {
      if (this.aiSendBtnEl) {
        this.aiSendBtnEl.disabled = false;
        this.aiSendBtnEl.textContent = "전송";
      }
      this.aiChatResponseEl.textContent = response || "(빈 응답)";
      this.showToast('어딧노 AI 응답 수신 완료');
    });
  }

  copyAiResponse() {
    if (!this.aiChatResponseEl) return;
    const text = this.aiChatResponseEl.textContent;
    navigator.clipboard.writeText(text).then(() => {
      this.showToast('AI 응답이 클립보드에 복사되었습니다');
    });
  }

  clearAiResponse() {
    if (this.aiChatResponseEl) {
      this.aiChatResponseEl.textContent = "💡 대화 내역이 초기화되었습니다. 새로운 질문이나 지시를 입력하세요.";
    }
    if (this.aiPromptInputEl) {
      this.aiPromptInputEl.value = "";
    }
  }

  // 단축키 시스템
  initShortcuts() {
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        if (e.key === 'Escape') {
          this.closeAiSpecModal();
          this.closeAiChatModal();
        }
        return;
      }

      // Tab 키: 2D ⇄ 3D 모드 전환
      if (e.key === 'Tab') {
        e.preventDefault();
        this.toggleDimensionMode();
        return;
      }

      // Ctrl 단축키
      if (e.ctrlKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        this.saveData();
        this.showToast('저장 완료');
      } else if (e.ctrlKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        this.openAiSpecModal();
      } else if (e.ctrlKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        this.openAiChatModal();
      }

      // 3D 전용 카메라 프리셋 단축키
      if (this.is3DMode) {
        if (e.key === '1') { // 1: Top 뷰
          this.engine3D.setViewPreset('top');
          this.showToast('📐 Top 뷰 (평면 수직)');
        } else if (e.key === '2') { // 2: Front 뷰
          this.engine3D.setViewPreset('front');
          this.showToast('🏢 Front 뷰 (Z축 층별 조망)');
        } else if (e.key === '3') { // 3: Isometric 뷰
          this.engine3D.setViewPreset('iso');
          this.showToast('🌌 Isometric 입체 뷰');
        } else if (e.key.toLowerCase() === 'r') { // R: Reset 뷰
          this.engine3D.setViewPreset('reset');
          this.showToast('🏠 기본 홈 뷰');
        } else if (e.key.toLowerCase() === 'f' || e.code === 'Space') { // F / Space: 포커스 비행
          e.preventDefault();
          const targetNode = this.projectData.boards[this.drillDown.getCurrentBoardId()].nodes.find(n => n.id === this.engine3D.selectedNodeId);
          if (targetNode) {
            this.engine3D.flyToNode(targetNode);
            this.showToast(`🎯 [${targetNode.title}] 포커스 착륙`);
          }
        } else if (e.key === 'PageUp' || e.key === ']') { // 층 위로
          this.engine3D.shiftLayer(1);
        } else if (e.key === 'PageDown' || e.key === '[') { // 층 아래로
          this.engine3D.shiftLayer(-1);
        }
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        this.deleteSelectedNode();
      } else if (e.key === 'Escape') {
        this.closeAiSpecModal();
        this.closeTabletModal();
      }
    });
  }

  // 태블릿 연동 모달
  openTabletModal() {
    const modal = document.getElementById('tablet-modal');
    if (!modal) return;

    if (this.backend && this.backend.getTabletConnectionInfo) {
      this.backend.getTabletConnectionInfo((infoStr) => {
        try {
          const info = JSON.parse(infoStr);
          const inputEl = document.getElementById('tablet-url-input');
          if (inputEl) inputEl.value = info.local_url;
          const gistEl = document.getElementById('tablet-gist-id');
          if (gistEl) gistEl.value = info.gist_id;
        } catch (e) {}
      });
    } else {
      const inputEl = document.getElementById('tablet-url-input');
      if (inputEl) inputEl.value = window.location.href;
    }
    modal.classList.add('active');
  }

  closeTabletModal() {
    const modal = document.getElementById('tablet-modal');
    if (modal) modal.classList.remove('active');
  }

  // 소스코드 GitHub 원클릭 푸시
  pushCodeToGitHub() {
    this.showToast('🚀 GitHub로 소스코드 업데이트 중...');
    if (this.backend && this.backend.gitCommitAndPush) {
      const msg = `update: project map changes at ${new Date().toLocaleTimeString()}`;
      this.backend.gitCommitAndPush(msg, (success) => {
        if (success) {
          this.showToast('✅ GitHub 레포지토리 푸시 완료!');
        } else {
          this.showToast('⚠️ GitHub 푸시 실패');
        }
      });
    } else {
      this.showToast('웹 환경에서는 Git 푸시를 지원하지 않습니다.');
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.app = new ProjectMapApp();
});
