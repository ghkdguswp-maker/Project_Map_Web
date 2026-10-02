/**
 * Project Map Simulation Engine (v1.0)
 * 
 * Features:
 * - Topological & Event-Driven Node Execution Pipeline
 * - Real-Time Visual Data Packet Propagation (Node -> Edge -> Target Node)
 * - Live Cyberpunk Simulation Terminal Console with Realistic Context Logs
 * - Dynamic Step-by-Step, Auto-Play, Speed Multiplier, and Reset Controls
 * - Auto Camera Tracking to Active Simulation Node
 */

class SimulationEngine {
  constructor(app) {
    this.app = app;
    this.isRunning = false;
    this.isPaused = false;
    this.speed = 1.0; // 1x, 2x, 4x
    this.currentStep = 0;
    this.executionQueue = [];
    this.visitedNodeIds = new Set();
    this.activeNodeIds = new Set();
    this.stepTimeout = null;
    this.autoCameraTrack = true;

    this.initDOM();
  }

  initDOM() {
    this.hudEl = document.getElementById('simulation-hud');
    this.terminalEl = document.getElementById('simulation-terminal');
    this.terminalBodyEl = document.getElementById('simulation-terminal-body');
    this.playBtnEl = document.getElementById('sim-btn-play');
    this.speedBtnEl = document.getElementById('sim-btn-speed');
    this.statusTextEl = document.getElementById('sim-hud-status');
  }

  // 시뮬레이션 시작 / 재개
  start(startNodeId = null) {
    if (this.isPaused) {
      this.isPaused = false;
      this.isRunning = true;
      this.updateHudState();
      this.log('SYS', '▶️ 시뮬레이션을 재개합니다.');
      this.processQueue();
      return;
    }

    this.reset();
    this.isRunning = true;
    this.isPaused = false;
    this.updateHudState();

    const currentBoard = this.app.drillDown.getCurrentBoard();
    if (!currentBoard.nodes || currentBoard.nodes.length === 0) {
      this.log('WARN', '시뮬레이션할 노드가 없습니다.');
      this.stop();
      return;
    }

    this.log('SYS', `🚀 [${currentBoard.title || '프로젝트 맵'}] 시뮬레이션 파이프라인 가동!`);

    // 시작 노드 결정
    if (startNodeId) {
      this.executionQueue.push(startNodeId);
      const n = currentBoard.nodes.find(x => x.id === startNodeId);
      this.log('FLOW', `🎯 트리거 노드: [${n ? n.title : startNodeId}]`);
    } else {
      // 인입 엣지가 없는 루트/시작 노드들을 우선 큐에 등록
      const targetNodeIds = new Set(currentBoard.edges.map(e => e.to));
      const rootNodes = currentBoard.nodes.filter(n => !targetNodeIds.has(n.id));

      if (rootNodes.length > 0) {
        rootNodes.forEach(n => this.executionQueue.push(n.id));
        this.log('FLOW', `📌 시작 지점 노드 ${rootNodes.length}개 탐색 완료.`);
      } else {
        // 순환 그래프인 경우 첫 번째 노드부터 시작
        this.executionQueue.push(currentBoard.nodes[0].id);
        this.log('FLOW', `📌 순환 루프 감지: [${currentBoard.nodes[0].title}]부터 시작.`);
      }
    }

    if (this.terminalEl && !this.terminalEl.classList.contains('active')) {
      this.terminalEl.classList.add('active');
    }

    this.processQueue();
  }

  // 일시 정지
  pause() {
    this.isPaused = true;
    this.isRunning = false;
    clearTimeout(this.stepTimeout);
    this.updateHudState();
    this.log('SYS', '⏸️ 시뮬레이션이 일시 정지되었습니다.');
  }

  // 정지 및 초기화
  reset() {
    this.isRunning = false;
    this.isPaused = false;
    this.currentStep = 0;
    this.executionQueue = [];
    this.visitedNodeIds.clear();
    this.activeNodeIds.clear();
    clearTimeout(this.stepTimeout);

    // 모든 노드 3D/2D 상태 복구
    const currentBoard = this.app.drillDown.getCurrentBoard();
    if (currentBoard.nodes) {
      currentBoard.nodes.forEach(n => {
        const el = document.getElementById(`node-3d-${n.id}`);
        if (el) {
          el.classList.remove('status-running', 'sim-active', 'sim-waiting');
        }
      });
    }

    this.updateHudState();
    if (this.statusTextEl) this.statusTextEl.textContent = '대기중 (Idle)';
    this.log('SYS', '⏹️ 시뮬레이션 상태가 리셋되었습니다.');
  }

  // 1단계만 실행 (Step)
  step() {
    if (!this.isRunning && !this.isPaused && this.executionQueue.length === 0) {
      this.start();
      this.pause();
      return;
    }

    this.isPaused = true;
    this.isRunning = false;
    this.updateHudState();
    this.processNextStep();
  }

  // 속도 전환 (1x -> 2x -> 4x)
  cycleSpeed() {
    if (this.speed === 1.0) this.speed = 2.0;
    else if (this.speed === 2.0) this.speed = 4.0;
    else this.speed = 1.0;

    if (this.speedBtnEl) {
      this.speedBtnEl.textContent = `${this.speed}x`;
    }
    this.log('SYS', `⚡ 시뮬레이션 속도: ${this.speed}x`);
  }

  // 큐 처리 루프
  processQueue() {
    if (!this.isRunning || this.isPaused) return;

    if (this.executionQueue.length === 0 && this.activeNodeIds.size === 0) {
      this.finishSimulation();
      return;
    }

    if (this.executionQueue.length > 0) {
      this.processNextStep();
    }
  }

  processNextStep() {
    if (this.executionQueue.length === 0) return;

    const nodeId = this.executionQueue.shift();
    if (this.visitedNodeIds.has(nodeId)) {
      // 이미 방문한 노드는 재진입 방지 (무한 루프 방지)
      if (this.isRunning && !this.isPaused) {
        this.processQueue();
      }
      return;
    }

    this.currentStep++;
    this.visitedNodeIds.add(nodeId);
    this.activeNodeIds.add(nodeId);

    const currentBoard = this.app.drillDown.getCurrentBoard();
    const node = currentBoard.nodes.find(n => n.id === nodeId);
    if (!node) {
      this.activeNodeIds.delete(nodeId);
      this.processQueue();
      return;
    }

    // 1. 노드 가동 시각 효과 (RUNNING 상태 점등)
    const el = document.getElementById(`node-3d-${node.id}`);
    if (el) {
      el.classList.add('status-running');
    }

    // 카메라 자동 추적
    if (this.autoCameraTrack && this.app.is3DMode && this.app.engine3D) {
      this.app.engine3D.flyToNode(node);
    }

    if (this.statusTextEl) {
      this.statusTextEl.innerHTML = `<span style="color:#00f0ff;">⚡ 실행중: [${this.escape(node.title)}]</span>`;
    }

    this.log('EXEC', `▶ [Step ${this.currentStep}] 노드 가동: <strong>${this.escape(node.title)}</strong> (${node.category})`);

    // 2. 노드 타입별 실감나는 가상 작업 연산 시뮬레이션
    const delay = Math.max(350, Math.round(1400 / this.speed));

    this.stepTimeout = setTimeout(() => {
      this.completeNodeTask(node);

      // 다음 하류 노드(outgoing edges) 탐색
      const outgoingEdges = currentBoard.edges.filter(e => e.from === node.id);
      
      if (outgoingEdges.length > 0) {
        outgoingEdges.forEach((edge, idx) => {
          const targetNode = currentBoard.nodes.find(n => n.id === edge.to);
          const labelDesc = edge.label ? `"${edge.label}"` : '기본 파이프라인';
          
          this.log('FLOW', `  ➔ 파이프라인 전송 [${labelDesc}] ➔ <strong>${targetNode ? this.escape(targetNode.title) : edge.to}</strong>`);

          if (targetNode && !this.visitedNodeIds.has(targetNode.id)) {
            this.executionQueue.push(targetNode.id);
          }
        });
      } else {
        this.log('DONE', `  🏁 [${this.escape(node.title)}] 하류 연결 없음 (파이프라인 터미널)`);
      }

      this.activeNodeIds.delete(nodeId);

      // 자동 다음 스텝 진행
      if (this.isRunning && !this.isPaused) {
        const nextDelay = Math.max(200, Math.round(700 / this.speed));
        this.stepTimeout = setTimeout(() => {
          this.processQueue();
        }, nextDelay);
      }
    }, delay);
  }

  // 노드별 가상 작업 완료 처리 및 현실적 콘솔 로그 출력
  completeNodeTask(node) {
    const el = document.getElementById(`node-3d-${node.id}`);
    if (el) {
      el.classList.remove('status-running');
      el.classList.add('sim-active');
    }

    // 카테고리별 맞춤 로그
    if (node.category === 'goal') {
      this.log('INFO', `  🎯 마일스톤 검증: 목표 지표 적합성 검토 완료 (100% 충족)`);
    } else if (node.category === 'idea') {
      this.log('INFO', `  💡 아이디어 컨셉: 비즈니스 가치 모델링 및 Feasibility 검토 통과`);
    } else if (node.category === 'strategy') {
      this.log('INFO', `  📝 로드맵 계획: 실행 전략 리소스 할당 완료 (Phase 가동 준비)`);
    } else if (node.category === 'task') {
      this.log('INFO', `  📌 태스크 실행: 할일 액션 아이템 처리 완료 [Checked]`);
    } else if (node.category === 'ai' || node.type === 'markdown') {
      const tokens = 150 + Math.floor(Math.random() * 200);
      this.log('INFO', `  🤖 AI 오케스트레이션: LLM 프롬프트 추론 완료 (${tokens} tokens, 48ms)`);
    } else if (node.category === 'database' || node.type === 'db_schema') {
      const rows = 10 + Math.floor(Math.random() * 90);
      this.log('INFO', `  💾 DB 트랜잭션: 스키마 인덱싱 및 ${rows}건 레코드 커밋 (Latency: 6ms)`);
    } else if (node.type === 'checklist' && node.data && node.data.items) {
      this.log('INFO', `  📋 체크리스트: ${node.data.items.length}개 엔지니어링 항목 전수 통과 [OK]`);
    } else {
      this.log('INFO', `  ⚡ 시스템 컴포넌트: 정상 연산 및 상태 시그널 송출 완료 [200 OK]`);
    }
  }

  // 전체 시뮬레이션 완료
  finishSimulation() {
    this.isRunning = false;
    this.isPaused = false;
    this.updateHudState();

    if (this.statusTextEl) {
      this.statusTextEl.innerHTML = `<span style="color:#10b981; font-weight:bold;">🎉 시뮬레이션 완료 (${this.visitedNodeIds.size}개 노드 가동)</span>`;
    }

    this.log('SYS', `✨ ========================================================`);
    this.log('SYS', `🎉 [시뮬레이션 완주] 총 ${this.visitedNodeIds.size}개 노드가 정상적으로 실행 및 검증되었습니다!`);
    this.log('SYS', `✨ ========================================================`);

    this.app.showToast('🎉 전체 파이프라인 시뮬레이션 성공!');
  }

  // HUD 버튼 UI 상태 업데이트
  updateHudState() {
    if (!this.playBtnEl) return;
    if (this.isRunning) {
      this.playBtnEl.innerHTML = '⏸️ 일시정지';
      this.playBtnEl.classList.add('active');
    } else {
      this.playBtnEl.innerHTML = '▶️ 시뮬레이션';
      this.playBtnEl.classList.remove('active');
    }
  }

  // 실시간 터미널 콘솔 로그 기록
  log(type, msg) {
    if (!this.terminalBodyEl) return;

    const time = new Date().toTimeString().split(' ')[0];
    const logItem = document.createElement('div');
    logItem.className = `sim-log-item log-${type.toLowerCase()}`;

    let badge = `<span class="log-badge badge-${type.toLowerCase()}">${type}</span>`;
    logItem.innerHTML = `<span class="log-time">[${time}]</span> ${badge} <span class="log-text">${msg}</span>`;

    this.terminalBodyEl.appendChild(logItem);
    this.terminalBodyEl.scrollTop = this.terminalBodyEl.scrollHeight;
  }

  clearLogs() {
    if (this.terminalBodyEl) {
      this.terminalBodyEl.innerHTML = '<div style="color:#64748b; font-size:11px; padding:4px;">로그가 초기화되었습니다.</div>';
    }
  }

  toggleTerminal() {
    if (!this.terminalEl) return;
    this.terminalEl.classList.toggle('active');
  }

  escape(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

window.SimulationEngine = SimulationEngine;
