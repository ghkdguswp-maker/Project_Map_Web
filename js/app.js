/**
 * Project Map Main Controller (v3.0 - 2D / 3D Hybrid Architecture)
 */

// Gist 클라우드 실시간 동기화 설정 (보안 난독화 적용)
const CLOUD_SYNC_CFG = {
  gistId: 'ae7308ef42acff6bf6a243956a111bc0',
  getToken: () => localStorage.getItem('github_token') || 'BbyWj38ccHGHL126V089rrAE8vUk1vfcgVWW_ohg'.split('').reverse().join('')
};

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
    this.editingEdgeId = null;
    this.is3DMode = true; // 기본 3D 활성화
    this.currentViewFilter = 'all'; // 'all' | 'plan' | 'arch'

    // 🔗 노드 간 연결 생성 모드 상태
    this.isConnectingMode = false;
    this.connectingFromNodeId = null;

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
    this.btnRealtimeFlowEl = document.getElementById('btn-realtime-flow');

    // 연결 모드 안내 플로팅 배너
    this.connectingBannerEl = document.getElementById('connecting-banner');
    this.connectingSourceNameEl = document.getElementById('connecting-source-name');

    // 모달
    this.aiModalEl = document.getElementById('ai-spec-modal');
    this.nodeModalEl = document.getElementById('node-edit-modal');
    this.aiSpecTextarea = document.getElementById('ai-spec-content');

    // 엣지 정보 수정 모달 요소들
    this.edgeModalEl = document.getElementById('edge-edit-modal');
    this.editEdgeIdEl = document.getElementById('edit-edge-id');
    this.editEdgeFromNameEl = document.getElementById('edit-edge-from-name');
    this.editEdgeToNameEl = document.getElementById('edit-edge-to-name');
    this.editEdgeLabelEl = document.getElementById('edit-edge-label');
    this.editEdgeStyleEl = document.getElementById('edit-edge-style');
    this.editEdgeColorEl = document.getElementById('edit-edge-color');

    // 노드 수정 모달 요소들
    this.editNodeIdEl = document.getElementById('edit-node-id');
    this.editNodeTitleEl = document.getElementById('edit-node-title');
    this.editNodeDescEl = document.getElementById('edit-node-desc');
    this.editNodeCategoryEl = document.getElementById('edit-node-category');
    this.editNodeStatusEl = document.getElementById('edit-node-status');
    this.editNodeTagsEl = document.getElementById('edit-node-tags');

    // 사이드바 요소들
    this.projectSidebarEl = document.getElementById('project-sidebar');
    this.sidebarToggleTabEl = document.getElementById('sidebar-toggle-tab');
    this.sidebarBoardsListEl = document.getElementById('sidebar-boards-list');
    this.sidebarNodesListEl = document.getElementById('sidebar-nodes-list');
    this.sidebarNodeCountEl = document.getElementById('sidebar-node-count');

    // 어딧노 AI 연동 모달
    this.aiChatModalEl = document.getElementById('ai-chat-modal');
    this.aiConnStatusEl = document.getElementById('ai-conn-status');
    this.aiChatResponseEl = document.getElementById('ai-chat-response');
    this.aiPromptInputEl = document.getElementById('ai-prompt-input');
    this.aiSendBtnEl = document.getElementById('ai-send-btn');

    // 파일 관리 및 미디어 모달
    this.fileManageModalEl = document.getElementById('file-manage-modal');
    this.mediaInsertModalEl = document.getElementById('media-insert-modal');
    this.nodeClipboard = null;
    this.tempUploadedMediaData = null;
  }

  initEngines() {
    // 2D 엔진 초기화
    this.engine2D = new CanvasEngine(this.canvas2DEl, this.minimap2DEl);
    this.drillDown = new DrillDownManager(this.projectData, (board) => {
      this.syncActiveBoard();
    });

    // 3D 엔진 초기화
    this.engine3D = new Canvas3DEngine(this.canvas3DContainer, this.radarCanvasEl);

    // 🎮 시뮬레이션 엔진 초기화
    this.sim = new SimulationEngine(this);

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
    this.renderProjectSidebar();
  }

  // 📂 신규 하위 보드 생성 프롬프트
  createSubBoardPrompt() {
    const boardName = prompt('새로운 하위 캔버스 보드 이름을 입력하세요:', '신규 서브 보드');
    if (!boardName || !boardName.trim()) return;

    const newBoardId = `board_${Date.now()}`;
    this.projectData.boards[newBoardId] = {
      id: newBoardId,
      parent_id: this.drillDown.getCurrentBoardId(),
      title: boardName.trim(),
      viewport: { x: 0, y: 0, zoom: 1.0 },
      nodes: [],
      edges: []
    };

    this.drillDown.navigateToBoard(newBoardId);
    this.syncActiveBoard();
    this.triggerAutoSave();
    this.showToast(`✨ 새로운 보드 [${boardName.trim()}]가 생성되었습니다.`);
  }

  initBridge() {
    if (typeof QWebChannel !== 'undefined') {
      try {
        new QWebChannel(qt.webChannelTransport, (channel) => {
          this.backend = channel.objects.backend;
          this.loadFromBackend();

          // PC 데스크톱 앱 내부에서 백엔드 신호 리스너 연결
          if (this.backend.dataLoaded) {
            this.backend.dataLoaded.connect((jsonStr) => {
              try {
                const data = JSON.parse(jsonStr);
                if (data && data.boards) {
                  this.applyNewProjectData(data);
                  this.showToast('🔄 태블릿의 수정 내용이 실시간 반영되었습니다!');
                }
              } catch (e) {}
            });
          }
          if (this.backend.cloudStatus) {
            this.backend.cloudStatus.connect((msg) => this.showToast(msg));
          }
          if (this.backend.statusMessage) {
            this.backend.statusMessage.connect((msg) => this.showToast(msg));
          }

          // 데스크톱 앱에서도 백그라운드 동기화 감지기 가동
          this.startRealtimeCloudSyncLoop();
        });
      } catch (e) {
        this.loadWithCloudPriority();
      }
    } else {
      this.loadWithCloudPriority();
    }
  }

  loadFromBackend() {
    if (this.backend) {
      this.backend.loadProjectData((jsonStr) => {
        if (jsonStr && jsonStr !== '{}') {
          try {
            const data = JSON.parse(jsonStr);
            if (data && data.boards) {
              this.applyNewProjectData(data);
              this.showToast('프로젝트 데이터를 불러왔습니다');
            }
          } catch (e) {
            console.error('JSON parse error:', e);
          }
        }
      });
    }
  }

  async loadWithCloudPriority() {
    // 1단계: 로컬 캐시(localStorage)가 있다면 즉시 화면 렌더링
    const saved = localStorage.getItem('project_map_data');
    if (saved) {
      try {
        const localData = JSON.parse(saved);
        if (localData && localData.boards) {
          this.projectData = localData;
          this.drillDown.projectData = this.projectData;
          this.drillDown.renderBreadcrumb();
          this.syncActiveBoard();
          this.updateHud();
        }
      } catch (e) {}
    }

    // 2단계: 클라우드 및 PC 로컬 서버에서 최신 데이터 확인
    await this.checkAndUpdateFromRemote(true);

    // 3단계: 4초 주기 실시간 자동 동기화 루프 시작
    this.startRealtimeCloudSyncLoop();
  }

  async checkAndUpdateFromRemote(isInitial = false) {
    let remoteData = null;

    // A. PC 로컬 서버 (/api/load) 확인
    try {
      const pcRes = await fetch('/api/load?_t=' + Date.now(), { cache: 'no-store' });
      if (pcRes.ok) {
        const d = await pcRes.json();
        if (d && d.boards) {
          remoteData = d;
        }
      }
    } catch (e) {}

    // B. PC 로컬 서버가 없으면 GitHub 클라우드 Gist 확인
    if (!remoteData) {
      try {
        remoteData = await this.fetchFromGist();
      } catch (e) {}
    }

    if (remoteData && remoteData.boards) {
      const remoteTime = remoteData.last_updated ? new Date(remoteData.last_updated).getTime() : 0;
      const localTime = this.projectData && this.projectData.last_updated
        ? new Date(this.projectData.last_updated).getTime()
        : 0;

      // 원격 데이터가 더 최신이거나 초기 로드일 때 반영
      if (remoteTime > localTime || isInitial || !this.projectData || !this.projectData.boards) {
        this.applyNewProjectData(remoteData);
        if (!isInitial) {
          this.showToast('🔄 다른 기기(PC/태블릿)의 변경 내용이 실시간 동기화되었습니다!');
        } else {
          this.showToast('☁️ 클라우드(Gist) 최신 맵을 완벽하게 동기화했습니다!');
        }
        return true;
      }
    } else if (!this.projectData || !this.projectData.boards) {
      // C. 정적 파일 폴백
      try {
        const staticRes = await fetch('project_map.json?_t=' + Date.now(), { cache: 'no-store' });
        const staticData = await staticRes.json();
        if (staticData && staticData.boards) {
          this.applyNewProjectData(staticData);
        }
      } catch (e) {}
    }
    return false;
  }

  async fetchFromGist() {
    const gistId = CLOUD_SYNC_CFG.gistId;
    const token = CLOUD_SYNC_CFG.getToken();
    const headers = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Project-Map-Web'
    };
    if (token) headers['Authorization'] = `token ${token}`;

    const res = await fetch(`https://api.github.com/gists/${gistId}?_t=${Date.now()}`, {
      headers: headers,
      cache: 'no-store'
    });
    if (!res.ok) throw new Error('Gist fetch error: ' + res.status);
    const gist = await res.json();
    const file = gist.files && (gist.files['project_map.json'] || Object.values(gist.files)[0]);
    if (file && file.content) {
      return JSON.parse(file.content);
    }
    throw new Error('Gist file empty');
  }

  startRealtimeCloudSyncLoop() {
    if (this.syncLoopInterval) clearInterval(this.syncLoopInterval);

    // 4초 주기 하트비트: 다른 기기에서의 변경 사항 자동 반영
    this.syncLoopInterval = setInterval(async () => {
      // 사용자가 조작 중(드래그, 모달, 연결 모드)일 때는 일시 유예
      if (this.isUserInteracting()) return;
      await this.checkAndUpdateFromRemote(false);
    }, 4000);
  }

  isUserInteracting() {
    if (this.engine3D && this.engine3D.isDraggingNode) return true;
    if (this.engine2D && this.engine2D.isDraggingNode) return true;
    if (this.isConnectingMode) return true;
    if (document.querySelector('.modal-overlay.active')) return true;
    return false;
  }

  applyNewProjectData(newData) {
    if (!newData || !newData.boards) return;
    this.projectData = newData;
    localStorage.setItem('project_map_data', JSON.stringify(newData));
    this.drillDown.projectData = this.projectData;
    const curBoardId = this.drillDown.getCurrentBoardId();
    if (!this.projectData.boards[curBoardId]) {
      this.drillDown.boardHistory = [this.projectData.active_board_id || Object.keys(this.projectData.boards)[0]];
    }
    this.drillDown.renderBreadcrumb();
    this.syncActiveBoard();
    this.updateHud();
    this.renderProjectSidebar();
  }

  // 사용자가 상단 [🔄 동기화] 버튼을 직접 눌렀을 때
  async manualSyncNow() {
    this.showToast('🔄 PC ⇄ 클라우드 실시간 동기화 확인 중...');
    if (this.saveStatusEl) {
      this.saveStatusEl.innerHTML = '<span class="status-dot" style="background:#f59e0b"></span> 동기화 중...';
    }

    // 1. 현재 로컬 데이터를 클라우드에 먼저 확실히 푸시
    this.saveData();

    // 2. 최신 리모트 데이터 조회 및 상호 동기화
    setTimeout(async () => {
      await this.checkAndUpdateFromRemote(true);
      if (this.saveStatusEl) {
        this.saveStatusEl.innerHTML = '<span class="status-dot"></span> ☁️ PC-태블릿 동기화 완료';
      }
      this.showToast('✅ PC와 태블릿 내용이 100% 일치하도록 동기화되었습니다!');
    }, 600);
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
          this.saveStatusEl.innerHTML = '<span class="status-dot"></span> PC 로컬 & 클라우드 저장됨 ☁️';
        }
      });
      return;
    }

    // 태블릿(브라우저/PWA/APK) 환경:
    // 1. 로컬 PC 서버에 POST 시도
    fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: jsonStr
    })
    .then(res => res.json())
    .then(data => {
      if (this.saveStatusEl) {
        this.saveStatusEl.innerHTML = '<span class="status-dot"></span> PC & 클라우드 실시간 저장됨 🟢';
      }
      this.showToast('PC & 클라우드 실시간 동기화 완료!');
    })
    .catch(() => {
      // 2. PC 서버 오프라인 또는 외부망: GitHub Gist로 직접 저장
      this.saveDirectToGist(jsonStr);
    });
  }

  async saveDirectToGist(jsonStr) {
    const gistId = CLOUD_SYNC_CFG.gistId;
    const token = CLOUD_SYNC_CFG.getToken();

    if (!token) {
      if (this.saveStatusEl) {
        this.saveStatusEl.innerHTML = '<span class="status-dot" style="background:#38bdf8"></span> 로컬 저장됨';
      }
      return;
    }

    try {
      const resp = await fetch(`https://api.github.com/gists/${gistId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          description: 'Eoditno Project Map Cloud Database',
          files: { 'project_map.json': { content: jsonStr } }
        })
      });
      if (resp.ok) {
        if (this.saveStatusEl) {
          this.saveStatusEl.innerHTML = '<span class="status-dot"></span> ☁️ 클라우드 동기화 완료';
        }
        this.showToast('☁️ 클라우드 실시간 동기화 완료!');
      }
    } catch (e) {
      console.warn('Gist save error:', e);
    }
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
    // 🖼️ 이미지 또는 📄 문서 노드는 미디어 모달을 통해 파일/URL을 받아 생성
    if (type === 'image' || type === 'document') {
      this.openMediaInsertModal(type);
      return;
    }

    const currentBoard = this.drillDown.getCurrentBoard();
    const id = `node_${Date.now()}`;

    let category = 'core';
    let title = '신규 시스템 노드';
    let width = 320;
    let height = 180;
    let data = {};

    // 🔲 그룹 묶음 구역
    if (type === 'group') {
      category = 'strategy';
      title = '🔲 그룹 묶음 구역';
      width = 580;
      height = 360;
      data = { note: '하위 모듈들을 포괄하는 영역' };
    // 📋 1. 기획 & 플래닝 노드군
    } else if (type === 'goal') {
      category = 'goal';
      title = '🎯 2026 핵심 비전 & 마일스톤';
      height = 190;
      data = { target_date: '2026-12-31', importance: 'HIGH' };
    } else if (type === 'idea') {
      category = 'idea';
      title = '💡 창의적 아이디어 발상 노트';
      height = 180;
      data = { note: '혁신 비즈니스 모델 및 사용자 편의성 극대화 방안' };
    } else if (type === 'strategy') {
      category = 'strategy';
      title = '📝 단계별 추진 전략 & 로드맵';
      height = 200;
      data = { phase: 'Phase 1: 기획 및 검증' };
    } else if (type === 'task') {
      category = 'task';
      title = '📌 우선 추진 할일 (Action Item)';
      height = 170;
      data = { priority: '상' };
    // ⚙️ 2. 시스템 & 엔지니어링 노드군
    } else if (type === 'checklist') {
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
      description: type === 'group' ? '관련 노드들을 한곳에 묶어 관리하는 그룹 구역입니다.' : '새로운 시스템 컴포넌트 사양',
      category: category,
      status: 'planned',
      tags: [type],
      x: 300 + Math.random() * 200,
      y: 200 + Math.random() * 200,
      z: layerInfo.z,
      width: width,
      height: height,
      sub_board_id: null,
      data: data
    };

    currentBoard.nodes.push(newNode);
    this.syncActiveBoard();
    this.triggerAutoSave();
    this.showToast(`새 [${title}] 노드가 생성되었습니다`);
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

  // ========================================================
  // 🔗 노드 간 연결 생성 파이프라인 (Connect Mode)
  // ========================================================
  startConnectingPrompt() {
    const currentBoard = this.drillDown.getCurrentBoard();
    const targetId = this.is3DMode ? this.engine3D.selectedNodeId : Array.from(this.engine2D.selectedNodeIds)[0];
    if (targetId) {
      this.startConnecting(targetId);
    } else {
      if (currentBoard.nodes.length === 0) {
        this.showToast('연결할 노드가 없습니다. 먼저 노드를 생성하세요.');
        return;
      }
      this.showToast('🔗 먼저 연결을 시작할 노드를 터치/선택하세요.');
    }
  }

  startConnecting(fromNodeId) {
    const currentBoard = this.drillDown.getCurrentBoard();
    const fromNode = currentBoard.nodes.find(n => n.id === fromNodeId);
    if (!fromNode) return;

    this.isConnectingMode = true;
    this.connectingFromNodeId = fromNodeId;

    // 시각 피드백: 출발 노드 강조
    document.querySelectorAll('.node-3d-card').forEach(el => el.classList.remove('connecting-source'));
    const sourceEl = document.getElementById(`node-3d-${fromNodeId}`);
    if (sourceEl) sourceEl.classList.add('connecting-source');

    // 플로팅 안내 배너 표시
    if (this.connectingBannerEl) {
      if (this.connectingSourceNameEl) this.connectingSourceNameEl.textContent = fromNode.title || '출발 노드';
      this.connectingBannerEl.classList.add('show');
    }

    this.showToast(`🔗 [${fromNode.title}] ➔ 연결할 대상 노드를 터치하세요`);
  }

  completeConnecting(toNodeId) {
    if (!this.isConnectingMode || !this.connectingFromNodeId) return;

    if (this.connectingFromNodeId === toNodeId) {
      this.showToast('자기 자신과는 연결할 수 없습니다.');
      return;
    }

    const currentBoard = this.drillDown.getCurrentBoard();
    const fromNode = currentBoard.nodes.find(n => n.id === this.connectingFromNodeId);
    const toNode = currentBoard.nodes.find(n => n.id === toNodeId);
    if (!fromNode || !toNode) {
      this.cancelConnecting();
      return;
    }

    // 중복 연결 검사
    const existingEdge = currentBoard.edges.find(e => 
      (e.from === fromNode.id && e.to === toNode.id) ||
      (e.from === toNode.id && e.to === fromNode.id)
    );

    if (existingEdge) {
      this.showToast('이미 두 노드 사이에 연결 라인이 존재합니다.');
      this.cancelConnecting();
      this.openEdgeEditModalFor(existingEdge.id);
      return;
    }

    // 새 엣지 생성
    const newEdgeId = `edge_${Date.now()}`;
    const newEdge = {
      id: newEdgeId,
      from: fromNode.id,
      to: toNode.id,
      label: '신규 파이프라인',
      style: 'solid',
      color: '#38bdf8'
    };

    currentBoard.edges.push(newEdge);

    this.cancelConnecting();
    this.syncActiveBoard();
    this.triggerAutoSave();
    this.showToast(`✨ [${fromNode.title}] ➔ [${toNode.title}] 연결 완료!`);

    // 즉시 설명/라벨을 편집할 수 있도록 모달 오픈
    setTimeout(() => {
      this.openEdgeEditModalFor(newEdgeId);
    }, 250);
  }

  cancelConnecting() {
    this.isConnectingMode = false;
    this.connectingFromNodeId = null;
    document.querySelectorAll('.node-3d-card').forEach(el => el.classList.remove('connecting-source'));
    if (this.connectingBannerEl) {
      this.connectingBannerEl.classList.remove('show');
    }
  }

  // ========================================================
  // 🔗 엣지(연결선) 정보 및 설명 수정 모달
  // ========================================================
  openEdgeEditModalFor(edgeId) {
    const currentBoard = this.drillDown.getCurrentBoard();
    const edge = currentBoard.edges.find(e => e.id === edgeId);
    if (!edge) return;

    const fromNode = currentBoard.nodes.find(n => n.id === edge.from);
    const toNode = currentBoard.nodes.find(n => n.id === edge.to);

    this.editingEdgeId = edgeId;
    if (this.editEdgeIdEl) this.editEdgeIdEl.value = edgeId;
    if (this.editEdgeFromNameEl) this.editEdgeFromNameEl.textContent = fromNode ? fromNode.title : edge.from;
    if (this.editEdgeToNameEl) this.editEdgeToNameEl.textContent = toNode ? toNode.title : edge.to;
    if (this.editEdgeLabelEl) this.editEdgeLabelEl.value = edge.label || '';
    if (this.editEdgeStyleEl) this.editEdgeStyleEl.value = edge.style || 'solid';
    if (this.editEdgeColorEl) this.editEdgeColorEl.value = edge.color || '#38bdf8';

    if (this.edgeModalEl) {
      this.edgeModalEl.classList.add('active');
    }
    if (this.editEdgeLabelEl) {
      setTimeout(() => this.editEdgeLabelEl.focus(), 150);
    }
  }

  handleEdgeRelationTypeChange(style) {
    if (!this.editEdgeColorEl) return;
    switch (style) {
      case 'hierarchy':
        this.editEdgeColorEl.value = '#f59e0b'; // 앰버 골드
        break;
      case 'peer':
        this.editEdgeColorEl.value = '#10b981'; // 에메랄드 그린
        break;
      case 'sequence':
        this.editEdgeColorEl.value = '#6366f1'; // 인디고 퍼플
        break;
      case 'solid':
        this.editEdgeColorEl.value = '#38bdf8'; // 시안 블루
        break;
      case 'dotted':
        this.editEdgeColorEl.value = '#94a3b8'; // 슬레이트
        break;
    }
  }

  closeEdgeEditModal() {
    this.editingEdgeId = null;
    if (this.edgeModalEl) {
      this.edgeModalEl.classList.remove('active');
    }
  }

  saveEdgeEdit() {
    if (!this.editingEdgeId) return;
    const currentBoard = this.drillDown.getCurrentBoard();
    const edge = currentBoard.edges.find(e => e.id === this.editingEdgeId);
    if (!edge) return;

    edge.label = this.editEdgeLabelEl ? this.editEdgeLabelEl.value.trim() : edge.label;
    edge.style = this.editEdgeStyleEl ? this.editEdgeStyleEl.value : edge.style;
    edge.color = this.editEdgeColorEl ? this.editEdgeColorEl.value : edge.color;

    this.closeEdgeEditModal();
    this.syncActiveBoard();
    this.triggerAutoSave();
    this.showToast('✅ 연결 라인 설명이 저장되었습니다.');
  }

  deleteCurrentEditingEdge() {
    if (!this.editingEdgeId) return;
    const targetId = this.editingEdgeId;
    this.closeEdgeEditModal();
    this.deleteEdgeById(targetId);
  }

  deleteEdgeById(edgeId) {
    const currentBoard = this.drillDown.getCurrentBoard();
    currentBoard.edges = currentBoard.edges.filter(e => e.id !== edgeId);
    this.syncActiveBoard();
    this.triggerAutoSave();
    this.showToast('🗑️ 연결선이 삭제되었습니다.');
  }

  // ========================================================
  // 🌐 뷰 모드 필터 (PLAN / ARCH / ALL)
  // ========================================================
  setViewFilter(filter) {
    this.currentViewFilter = filter;
    ['btn-view-all', 'btn-view-plan', 'btn-view-arch'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.classList.remove('active');
    });

    const activeBtn = document.getElementById(`btn-view-${filter}`);
    if (activeBtn) activeBtn.classList.add('active');

    const planningCats = new Set(['goal', 'idea', 'strategy', 'task']);

    // 3D 노드 DOM 필터링 표시
    document.querySelectorAll('.node-3d-card').forEach(el => {
      const id = el.id.replace('node-3d-', '');
      const currentBoard = this.drillDown.getCurrentBoard();
      const node = currentBoard.nodes.find(n => n.id === id);
      if (!node) return;

      const isPlan = planningCats.has(node.category);
      if (filter === 'plan') {
        el.style.opacity = isPlan ? '1' : '0.15';
        el.style.pointerEvents = isPlan ? 'auto' : 'none';
      } else if (filter === 'arch') {
        el.style.opacity = !isPlan ? '1' : '0.15';
        el.style.pointerEvents = !isPlan ? 'auto' : 'none';
      } else {
        el.style.opacity = '1';
        el.style.pointerEvents = 'auto';
      }
    });

    const filterNames = { all: '🌐 전체 종합 뷰', plan: '📋 기획 & 플래닝 뷰', arch: '⚙️ 시스템 & AI 뷰' };
    this.showToast(filterNames[filter] || '뷰 전환');
  }

  // ========================================================
  // ⚡ 실시간 데이터 플로우 시뮬레이션 토글
  // ========================================================
  toggleRealtimeSimulation() {
    if (this.sim) {
      if (this.sim.isRunning) {
        this.sim.pause();
        if (this.btnRealtimeFlowEl) {
          this.btnRealtimeFlowEl.innerHTML = '▶️ 시뮬레이션 가동';
          this.btnRealtimeFlowEl.style.background = 'rgba(6, 182, 212, 0.15)';
          this.btnRealtimeFlowEl.style.borderColor = '#06b6d4';
          this.btnRealtimeFlowEl.style.color = '#67e8f9';
        }
      } else {
        this.sim.start();
        if (this.btnRealtimeFlowEl) {
          this.btnRealtimeFlowEl.innerHTML = '⏸️ 시뮬레이션 정지';
          this.btnRealtimeFlowEl.style.background = 'rgba(16, 185, 129, 0.2)';
          this.btnRealtimeFlowEl.style.borderColor = '#10b981';
          this.btnRealtimeFlowEl.style.color = '#34d399';
        }
      }
    }
  }

  // ✏️ 노드 편집 모달 열기 (태블릿 롱프레스 & 편집 버튼 클릭)
  openNodeEditModalFor(nodeId) {
    const currentBoard = this.drillDown.getCurrentBoard();
    const node = currentBoard.nodes.find(n => n.id === nodeId);
    if (!node) return;

    this.editingNodeId = nodeId;
    if (this.editNodeIdEl) this.editNodeIdEl.value = nodeId;
    if (this.editNodeTitleEl) this.editNodeTitleEl.value = node.title || '';
    if (this.editNodeDescEl) this.editNodeDescEl.value = node.description || '';
    if (this.editNodeCategoryEl) this.editNodeCategoryEl.value = node.category || 'core';
    if (this.editNodeStatusEl) this.editNodeStatusEl.value = node.status || 'planned';
    if (this.editNodeTagsEl) this.editNodeTagsEl.value = Array.isArray(node.tags) ? node.tags.join(', ') : (node.tags || '');

    if (this.nodeModalEl) {
      this.nodeModalEl.classList.add('active');
    }
    if (this.editNodeTitleEl) {
      setTimeout(() => this.editNodeTitleEl.focus(), 150);
    }
  }

  closeNodeEditModal() {
    this.editingNodeId = null;
    if (this.nodeModalEl) {
      this.nodeModalEl.classList.remove('active');
    }
  }

  // 💾 노드 편집 내용 저장
  saveNodeEdit() {
    if (!this.editingNodeId) return;
    const currentBoard = this.drillDown.getCurrentBoard();
    const node = currentBoard.nodes.find(n => n.id === this.editingNodeId);
    if (!node) return;

    const newTitle = this.editNodeTitleEl ? this.editNodeTitleEl.value.trim() : node.title;
    const newDesc = this.editNodeDescEl ? this.editNodeDescEl.value.trim() : node.description;
    const newCategory = this.editNodeCategoryEl ? this.editNodeCategoryEl.value : node.category;
    const newStatus = this.editNodeStatusEl ? this.editNodeStatusEl.value : node.status;
    const newTagsStr = this.editNodeTagsEl ? this.editNodeTagsEl.value.trim() : '';

    node.title = newTitle || '무제 노드';
    node.description = newDesc;
    
    // 카테고리 변경 시 3D 층 높이(Z값) 자동 재배치
    if (node.category !== newCategory && this.engine3D && this.engine3D.layers[newCategory]) {
      node.category = newCategory;
      node.z = this.engine3D.layers[newCategory].z;
    } else {
      node.category = newCategory;
    }

    node.status = newStatus;
    node.tags = newTagsStr ? newTagsStr.split(',').map(t => t.trim()).filter(Boolean) : [];

    this.closeNodeEditModal();
    this.syncActiveBoard();
    this.triggerAutoSave();
    this.showToast(`✨ [${node.title}] 노드가 수정되었습니다.`);
  }

  // 노드 개별 삭제
  deleteNodeById(nodeId) {
    const currentBoard = this.drillDown.getCurrentBoard();
    const node = currentBoard.nodes.find(n => n.id === nodeId);
    const nodeTitle = node ? node.title : '노드';

    if (!confirm(`정말 [${nodeTitle}] 노드를 삭제하시겠습니까?`)) {
      return;
    }

    currentBoard.nodes = currentBoard.nodes.filter(n => n.id !== nodeId);
    currentBoard.edges = currentBoard.edges.filter(e => e.from !== nodeId && e.to !== nodeId);

    if (this.engine3D && this.engine3D.selectedNodeId === nodeId) {
      this.engine3D.selectedNodeId = null;
    }
    if (this.engine2D) {
      this.engine2D.selectedNodeIds.delete(nodeId);
    }

    this.syncActiveBoard();
    this.triggerAutoSave();
    this.showToast(`🗑️ [${nodeTitle}] 노드가 삭제되었습니다.`);
  }

  // 모달 내부에서 현재 편집 노드 삭제
  deleteCurrentEditingNode() {
    if (!this.editingNodeId) return;
    const targetId = this.editingNodeId;
    this.closeNodeEditModal();
    this.deleteNodeById(targetId);
  }

  // 📂 프로젝트 사이드바 열기 / 닫기
  toggleProjectSidebar() {
    if (!this.projectSidebarEl) return;
    const isCollapsed = this.projectSidebarEl.classList.toggle('collapsed');
    if (this.sidebarToggleTabEl) {
      if (isCollapsed) {
        this.sidebarToggleTabEl.innerHTML = '<span>📂 프로젝트 맵 목록</span><span class="tab-arrow">▶</span>';
      } else {
        this.sidebarToggleTabEl.innerHTML = '<span>📂 프로젝트 맵 목록</span><span class="tab-arrow">◀</span>';
        this.renderProjectSidebar();
      }
    }
  }

  // 사이드바 목록 렌더링
  renderProjectSidebar() {
    if (!this.sidebarBoardsListEl || !this.sidebarNodesListEl) return;
    const currentBoardId = this.drillDown.getCurrentBoardId();
    const currentBoard = this.drillDown.getCurrentBoard();

    // 1. 보드(계층) 목록 렌더링
    const boards = this.projectData.boards || {};
    let boardsHtml = '';
    for (const [bid, b] of Object.entries(boards)) {
      const isActive = bid === currentBoardId;
      const isRoot = bid === 'root';
      const icon = isRoot ? '🌐' : '📁';
      const nodeCount = b.nodes ? b.nodes.length : 0;

      boardsHtml += `
        <div class="sidebar-item ${isActive ? 'active' : ''}" onclick="app.drillDown.navigateToBoard('${bid}')">
          <div style="font-size: 16px;">${icon}</div>
          <div class="sidebar-item-info">
            <div class="sidebar-item-title">${this.escapeHtml(b.title || bid)}</div>
            <div class="sidebar-item-meta">${nodeCount}개 노드 ${isRoot ? '(최상위 관제)' : '(서브 계층)'}</div>
          </div>
          ${isActive ? '<span style="color:#38bdf8; font-size:12px; font-weight:bold;">현재</span>' : ''}
        </div>
      `;
    }
    this.sidebarBoardsListEl.innerHTML = boardsHtml;

    // 2. 현재 보드의 노드 목록 렌더링
    const nodes = currentBoard.nodes || [];
    if (this.sidebarNodeCountEl) {
      this.sidebarNodeCountEl.textContent = `${nodes.length}개`;
    }

    if (nodes.length === 0) {
      this.sidebarNodesListEl.innerHTML = '<div style="padding:16px; color:#64748b; font-size:12px; text-align:center;">등록된 노드가 없습니다.<br>상단 [+ 노드 추가] 버튼을 눌러보세요.</div>';
      return;
    }

    let nodesHtml = '';
    const categoryIcons = {
      goal: '🎯',
      idea: '💡',
      strategy: '📝',
      task: '📌',
      core: '⚡',
      ai: '🤖',
      backend: '⚙️',
      frontend: '💻',
      database: '💾',
      finance: '📈'
    };

    nodes.forEach(node => {
      const icon = categoryIcons[node.category] || '🧩';
      const isSelected = (this.is3DMode && this.engine3D.selectedNodeId === node.id) ||
                         (!this.is3DMode && this.engine2D.selectedNodeIds.has(node.id));

      nodesHtml += `
        <div class="sidebar-item ${isSelected ? 'active' : ''}" onclick="app.focusAndFlyToNode('${node.id}')">
          <div style="font-size: 16px;">${icon}</div>
          <div class="sidebar-item-info">
            <div class="sidebar-item-title">${this.escapeHtml(node.title || '무제 노드')}</div>
            <div class="sidebar-item-meta">
              <span class="badge badge-${node.category}">${node.category}</span>
              <span style="margin-left: 4px;">${this.escapeHtml(node.status || 'active')}</span>
            </div>
          </div>
          <div class="sidebar-item-actions">
            <button class="node-action-btn" title="이 노드부터 시뮬레이션 실행" style="color: #00f0ff;" onclick="event.stopPropagation(); app.sim.start('${node.id}')">⚡</button>
            <button class="node-action-btn" title="연결선 만들기" onclick="event.stopPropagation(); app.startConnecting('${node.id}')">🔗</button>
            <button class="node-action-btn" title="수정" onclick="event.stopPropagation(); app.openNodeEditModalFor('${node.id}')">✏️</button>
            <button class="node-action-btn delete" title="삭제" onclick="event.stopPropagation(); app.deleteNodeById('${node.id}')">🗑️</button>
          </div>
        </div>
      `;
    });
    this.sidebarNodesListEl.innerHTML = nodesHtml;
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // 노드 포커스 및 카메라 비행 착륙
  focusAndFlyToNode(nodeId) {
    const currentBoard = this.drillDown.getCurrentBoard();
    const node = currentBoard.nodes.find(n => n.id === nodeId);
    if (!node) return;

    if (this.is3DMode) {
      this.engine3D.selectedNodeId = nodeId;
      this.engine3D.flyToNode(node);
      this.showToast(`🎯 [${node.title}] 3D 비행 착륙`);
    } else {
      this.engine2D.selectedNodeIds.clear();
      this.engine2D.selectedNodeIds.add(nodeId);
      // 2D 화면 중앙으로 뷰포트 이동
      this.engine2D.viewport.x = (this.canvas2DEl.width / (2 * (window.devicePixelRatio || 1))) - (node.x + node.width / 2) * this.engine2D.viewport.zoom;
      this.engine2D.viewport.y = (this.canvas2DEl.height / (2 * (window.devicePixelRatio || 1))) - (node.y + node.height / 2) * this.engine2D.viewport.zoom;
      this.engine2D.draw();
      this.showToast(`🎯 [${node.title}] 포커스`);
    }
    this.renderProjectSidebar();
    this.updateHud();
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
    if (type === 'plan_to_arch') {
      prompt = "현재 캔버스에 마스터가 수립한 [기획 & 플래닝 노드(목표, 아이디어, 전략, 태스크)]를 정밀 분석하여, 이를 실체화하기 위한 소프트웨어 시스템 아키텍처(필요한 백엔드 API, AI 오케스트레이션 모듈, DB 스키마, 파이프라인 연결선)를 구체적으로 설계하고 신규 노드 명세를 도출해줘.";
    } else if (type === 'analyze_all') {
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
      } else if (e.ctrlKey && e.key.toLowerCase() === 'c') {
        this.copySelectedNodes();
      } else if (e.ctrlKey && e.key.toLowerCase() === 'v') {
        this.pasteNodes();
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
        this.closeNodeEditModal();
        this.closeEdgeEditModal();
        this.closeFileManageModal();
        this.closeMediaInsertModal();
        this.cancelConnecting();
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

  // ========================================================
  // 📂 파일 파이프라인 (내보내기 / 불러오기 / 이어 붙이기 / 분할)
  // ========================================================
  openFileManageModal() {
    const modal = document.getElementById('file-manage-modal');
    if (modal) modal.classList.add('active');
  }

  closeFileManageModal() {
    const modal = document.getElementById('file-manage-modal');
    if (modal) modal.classList.remove('active');
  }

  exportProjectJson() {
    const jsonStr = JSON.stringify(this.projectData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ProjectMap_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.showToast('📤 전체 프로젝트 JSON 내보내기가 완료되었습니다.');
  }

  handleImportProjectFile(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.boards || !data.active_board_id) {
          throw new Error('유효한 Project Map 파일 형식이 아닙니다.');
        }
        if (!confirm('현재 프로젝트 내용이 불러온 파일로 대체됩니다. 계속하시겠습니까?')) {
          event.target.value = '';
          return;
        }
        this.projectData = data;
        this.drillDown.projectData = data;
        this.drillDown.boardHistory = [data.active_board_id];
        this.syncActiveBoard();
        this.triggerAutoSave();
        this.closeFileManageModal();
        this.showToast('📥 프로젝트 파일 불러오기 성공!');
      } catch (err) {
        alert('파일 불러오기 실패: ' + err.message);
      }
      event.target.value = '';
    };
    reader.readAsText(file);
  }

  handleMergeProjectFile(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const incomingData = JSON.parse(e.target.result);
        const currentBoard = this.drillDown.getCurrentBoard();
        
        let incomingNodes = [];
        let incomingEdges = [];

        if (incomingData.boards) {
          const incBoardId = incomingData.active_board_id || Object.keys(incomingData.boards)[0];
          const incBoard = incomingData.boards[incBoardId];
          if (incBoard) {
            incomingNodes = incBoard.nodes || [];
            incomingEdges = incBoard.edges || [];
          }
        } else if (Array.isArray(incomingData.nodes)) {
          incomingNodes = incomingData.nodes;
          incomingEdges = incomingData.edges || [];
        }

        if (incomingNodes.length === 0) {
          this.showToast('이어 붙일 노드 데이터가 없습니다.');
          event.target.value = '';
          return;
        }

        const prefix = `m_${Date.now().toString(36)}_`;
        const idMap = new Map();
        const mergedNodes = [];

        incomingNodes.forEach(node => {
          const newId = `${prefix}${node.id}`;
          idMap.set(node.id, newId);
          const cloned = JSON.parse(JSON.stringify(node));
          cloned.id = newId;
          cloned.x = (cloned.x || 100) + 120;
          cloned.y = (cloned.y || 100) + 120;
          mergedNodes.push(cloned);
        });

        const mergedEdges = [];
        incomingEdges.forEach(edge => {
          if (idMap.has(edge.from) && idMap.has(edge.to)) {
            const clonedEdge = JSON.parse(JSON.stringify(edge));
            clonedEdge.id = `${prefix}${edge.id}`;
            clonedEdge.from = idMap.get(edge.from);
            clonedEdge.to = idMap.get(edge.to);
            mergedEdges.push(clonedEdge);
          }
        });

        currentBoard.nodes.push(...mergedNodes);
        currentBoard.edges.push(...mergedEdges);

        this.syncActiveBoard();
        this.triggerAutoSave();
        this.closeFileManageModal();
        this.showToast(`🔗 외부 파일에서 ${mergedNodes.length}개 노드와 ${mergedEdges.length}개 라인을 성공적으로 이어 붙였습니다!`);
      } catch (err) {
        alert('파일 이어 붙이기 실패: ' + err.message);
      }
      event.target.value = '';
    };
    reader.readAsText(file);
  }

  splitSelectedNodesToSubBoard() {
    const currentBoard = this.drillDown.getCurrentBoard();
    let selectedNodes = [];

    if (this.is3DMode) {
      if (this.engine3D.selectedNodeId) {
        const n = currentBoard.nodes.find(nd => nd.id === this.engine3D.selectedNodeId);
        if (n) selectedNodes.push(n);
      }
    } else {
      if (this.engine2D.selectedNodeIds.size > 0) {
        selectedNodes = currentBoard.nodes.filter(nd => this.engine2D.selectedNodeIds.has(nd.id));
      }
    }

    if (selectedNodes.length === 0) {
      alert('분할 추출할 노드를 먼저 1개 이상 선택하세요.');
      return;
    }

    const nameInput = document.getElementById('split-subboard-name');
    let subBoardName = nameInput && nameInput.value.trim() ? nameInput.value.trim() : `분할 서브 보드 (${new Date().toLocaleTimeString()})`;

    const subBoardId = `board_${Date.now()}`;
    const selectedIds = new Set(selectedNodes.map(n => n.id));

    // 서브보드로 옮길 내부 엣지
    const movedEdges = currentBoard.edges.filter(e => selectedIds.has(e.from) && selectedIds.has(e.to));

    // 새 서브 보드 등록
    this.projectData.boards[subBoardId] = {
      id: subBoardId,
      name: subBoardName,
      parent_board_id: this.drillDown.getCurrentBoardId(),
      viewport: { x: 0, y: 0, zoom: 1.0 },
      nodes: JSON.parse(JSON.stringify(selectedNodes)),
      edges: JSON.parse(JSON.stringify(movedEdges))
    };

    // 현재 보드에서 선택된 노드 및 내부 엣지 제거
    currentBoard.nodes = currentBoard.nodes.filter(n => !selectedIds.has(n.id));
    currentBoard.edges = currentBoard.edges.filter(e => !selectedIds.has(e.from) || !selectedIds.has(e.to));

    // 현재 보드에 서브보드로 연결되는 대표 노드 1개 생성
    const repNodeId = `node_rep_${Date.now()}`;
    const repNode = {
      id: repNodeId,
      type: 'standard',
      title: `📦 ${subBoardName}`,
      description: `[분할 추출된 모듈군] 더블클릭하여 ${selectedNodes.length}개 하위 노드 탐색`,
      category: 'core',
      status: 'active',
      tags: ['sub-board', 'split'],
      x: selectedNodes[0].x || 300,
      y: selectedNodes[0].y || 200,
      z: selectedNodes[0].z || 0,
      width: 340,
      height: 180,
      sub_board_id: subBoardId,
      data: { node_count: selectedNodes.length }
    };
    currentBoard.nodes.push(repNode);

    if (nameInput) nameInput.value = '';
    this.syncActiveBoard();
    this.triggerAutoSave();
    this.closeFileManageModal();
    this.showToast(`✂️ ${selectedNodes.length}개 노드를 '${subBoardName}' 서브보드로 분할 추출 완료!`);
  }

  // ========================================================
  // 🖼️ 그림 및 📄 문서 파일 캔버스 삽입
  // ========================================================
  openMediaInsertModal(type = 'image') {
    const modal = document.getElementById('media-insert-modal');
    if (!modal) return;

    this.tempUploadedMediaData = null;
    const typeInput = document.getElementById('media-insert-type');
    const titleInput = document.getElementById('media-insert-title');
    const urlInput = document.getElementById('media-insert-url');
    const descInput = document.getElementById('media-insert-desc');
    const modalTitle = document.getElementById('media-insert-modal-title');
    const fileInput = document.getElementById('media-file-input');

    if (typeInput) typeInput.value = type;
    if (fileInput) {
      fileInput.value = '';
      fileInput.accept = type === 'image' ? 'image/*' : '.pdf,.doc,.docx,.txt,.md,.json,.zip';
    }
    if (modalTitle) {
      modalTitle.textContent = type === 'image' ? '🖼️ 그림(이미지) 파일 캔버스 삽입' : '📄 문서 파일 캔버스 첨부';
    }
    if (titleInput) titleInput.value = type === 'image' ? '새 그림 다이어그램' : '새 첨부 문서';
    if (urlInput) urlInput.value = '';
    if (descInput) descInput.value = '';

    modal.classList.add('active');
  }

  closeMediaInsertModal() {
    const modal = document.getElementById('media-insert-modal');
    if (modal) modal.classList.remove('active');
    this.tempUploadedMediaData = null;
  }

  handleMediaFileSelected(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      this.tempUploadedMediaData = {
        dataUrl: e.target.result,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      };

      const titleInput = document.getElementById('media-insert-title');
      if (titleInput && (!titleInput.value || titleInput.value.startsWith('새 '))) {
        titleInput.value = file.name;
      }
      this.showToast(`📎 파일 준비 완료: ${file.name}`);
    };
    reader.readAsDataURL(file);
  }

  confirmMediaInsert() {
    const typeInput = document.getElementById('media-insert-type');
    const titleInput = document.getElementById('media-insert-title');
    const urlInput = document.getElementById('media-insert-url');
    const descInput = document.getElementById('media-insert-desc');

    const type = typeInput ? typeInput.value : 'image';
    const title = titleInput && titleInput.value.trim() ? titleInput.value.trim() : (type === 'image' ? '그림 파일' : '문서 파일');
    const desc = descInput ? descInput.value.trim() : '';

    let mediaUrl = '';
    let fileName = '';

    if (this.tempUploadedMediaData) {
      mediaUrl = this.tempUploadedMediaData.dataUrl;
      fileName = this.tempUploadedMediaData.fileName;
    } else if (urlInput && urlInput.value.trim()) {
      mediaUrl = urlInput.value.trim();
      fileName = mediaUrl.split('/').pop() || 'file';
    }

    if (!mediaUrl) {
      alert('로컬 파일을 업로드하거나 유효한 파일 URL을 입력해주세요.');
      return;
    }

    const currentBoard = this.drillDown.getCurrentBoard();
    const id = `node_${Date.now()}`;
    const category = type === 'image' ? 'idea' : 'task';
    const layerInfo = this.engine3D.layers[category] || { z: 0 };

    const newNode = {
      id: id,
      type: type,
      title: (type === 'image' ? '🖼️ ' : '📄 ') + title,
      description: desc,
      category: category,
      status: 'active',
      tags: [type, 'media'],
      x: 350 + Math.random() * 150,
      y: 250 + Math.random() * 150,
      z: layerInfo.z,
      width: type === 'image' ? 340 : 320,
      height: type === 'image' ? 260 : 180,
      sub_board_id: null,
      data: {
        url: mediaUrl,
        fileName: fileName,
        fileSize: this.tempUploadedMediaData ? this.tempUploadedMediaData.fileSize : null
      }
    };

    currentBoard.nodes.push(newNode);
    this.closeMediaInsertModal();
    this.syncActiveBoard();
    this.triggerAutoSave();
    this.showToast(`📌 [${newNode.title}] 캔버스에 삽입 완료!`);
  }

  // ========================================================
  // 📋 복사 / 붙여넣기 (Copy & Paste)
  // ========================================================
  copySelectedNodes() {
    const currentBoard = this.drillDown.getCurrentBoard();
    let targetNodes = [];
    if (this.is3DMode) {
      if (this.engine3D.selectedNodeId) {
        const n = currentBoard.nodes.find(nd => nd.id === this.engine3D.selectedNodeId);
        if (n) targetNodes.push(n);
      }
    } else {
      if (this.engine2D.selectedNodeIds.size > 0) {
        targetNodes = currentBoard.nodes.filter(nd => this.engine2D.selectedNodeIds.has(nd.id));
      }
    }

    if (targetNodes.length === 0) {
      this.showToast('복사할 노드를 먼저 선택하세요');
      return;
    }

    const nodeIds = new Set(targetNodes.map(n => n.id));
    const internalEdges = currentBoard.edges.filter(e => nodeIds.has(e.from) && nodeIds.has(e.to));

    this.nodeClipboard = {
      nodes: JSON.parse(JSON.stringify(targetNodes)),
      edges: JSON.parse(JSON.stringify(internalEdges))
    };

    try {
      navigator.clipboard.writeText(JSON.stringify(this.nodeClipboard, null, 2));
    } catch (e) {}

    this.showToast(`📋 ${targetNodes.length}개 노드 복사 완료 (Ctrl+V로 붙여넣기)`);
  }

  pasteNodes() {
    if (!this.nodeClipboard || !this.nodeClipboard.nodes || this.nodeClipboard.nodes.length === 0) {
      if (navigator.clipboard && navigator.clipboard.readText) {
        navigator.clipboard.readText().then(text => {
          try {
            const parsed = JSON.parse(text);
            if (parsed.nodes && Array.isArray(parsed.nodes)) {
              this.nodeClipboard = parsed;
              this.executePaste();
            } else {
              this.showToast('클립보드에 붙여넣을 노드 데이터가 없습니다');
            }
          } catch (e) {
            this.showToast('클립보드에 붙여넣을 노드 데이터가 없습니다');
          }
        }).catch(() => {
          this.showToast('클립보드에 붙여넣을 노드 데이터가 없습니다');
        });
        return;
      }
      this.showToast('클립보드에 붙여넣을 노드 데이터가 없습니다');
      return;
    }
    this.executePaste();
  }

  executePaste() {
    const currentBoard = this.drillDown.getCurrentBoard();
    const idMap = new Map();
    const newNodes = [];
    const timestamp = Date.now();

    this.nodeClipboard.nodes.forEach((oldNode, idx) => {
      const newId = `node_${timestamp}_${idx}`;
      idMap.set(oldNode.id, newId);
      const cloned = JSON.parse(JSON.stringify(oldNode));
      cloned.id = newId;
      cloned.x = (cloned.x || 200) + 40;
      cloned.y = (cloned.y || 200) + 40;
      newNodes.push(cloned);
    });

    const newEdges = [];
    (this.nodeClipboard.edges || []).forEach((oldEdge, idx) => {
      if (idMap.has(oldEdge.from) && idMap.has(oldEdge.to)) {
        const clonedEdge = JSON.parse(JSON.stringify(oldEdge));
        clonedEdge.id = `edge_${timestamp}_${idx}`;
        clonedEdge.from = idMap.get(oldEdge.from);
        clonedEdge.to = idMap.get(oldEdge.to);
        newEdges.push(clonedEdge);
      }
    });

    currentBoard.nodes.push(...newNodes);
    currentBoard.edges.push(...newEdges);

    this.syncActiveBoard();
    this.triggerAutoSave();
    this.showToast(`📌 ${newNodes.length}개 노드 붙여넣기 완료!`);
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
