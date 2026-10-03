/**
 * Drill-Down & Hierarchy Manager
 * - Manages infinite sub-board nesting
 * - Breadcrumb navigation
 */

class DrillDownManager {
  constructor(projectData, onBoardSwitch) {
    this.projectData = projectData;
    this.onBoardSwitch = onBoardSwitch;
    this.historyStack = ['root']; // 브레드크럼 스택
  }

  getCurrentBoardId() {
    return this.historyStack[this.historyStack.length - 1];
  }

  getCurrentBoard() {
    const boardId = this.getCurrentBoardId();
    if (!this.projectData.boards[boardId]) {
      // 기본 보드 자동 생성
      this.projectData.boards[boardId] = {
        id: boardId,
        title: '하위 캔버스',
        viewport: { x: 0, y: 0, zoom: 1.0 },
        nodes: [],
        edges: []
      };
    }
    return this.projectData.boards[boardId];
  }

  enterSubBoard(node) {
    let subBoardId = node.sub_board_id;
    if (!subBoardId) {
      // 신규 서브보드 ID 자동 생성
      subBoardId = `board_${node.id}_${Date.now()}`;
      node.sub_board_id = subBoardId;

      this.projectData.boards[subBoardId] = {
        id: subBoardId,
        parent_id: this.getCurrentBoardId(),
        parent_node_id: node.id,
        title: `${node.title} (하위 캔버스)`,
        viewport: { x: 0, y: 0, zoom: 1.0 },
        nodes: [],
        edges: []
      };
    }

    this.historyStack.push(subBoardId);
    this.projectData.active_board_id = subBoardId;
    this.renderBreadcrumb();

    if (this.onBoardSwitch) {
      this.onBoardSwitch(this.getCurrentBoard());
    }
  }

  navigateBack() {
    if (this.historyStack.length <= 1) return;
    this.historyStack.pop();
    const targetBoardId = this.getCurrentBoardId();
    this.projectData.active_board_id = targetBoardId;
    this.renderBreadcrumb();

    if (this.onBoardSwitch) {
      this.onBoardSwitch(this.getCurrentBoard());
    }
  }

  navigateToBoard(targetBoardId) {
    const idx = this.historyStack.indexOf(targetBoardId);
    if (idx !== -1) {
      this.historyStack = this.historyStack.slice(0, idx + 1);
    } else {
      this.historyStack.push(targetBoardId);
    }
    this.projectData.active_board_id = targetBoardId;
    this.renderBreadcrumb();

    if (this.onBoardSwitch) {
      this.onBoardSwitch(this.getCurrentBoard());
    }
  }

  renderBreadcrumb() {
    const container = document.getElementById('breadcrumb-container');
    if (!container) return;

    container.innerHTML = '';

    this.historyStack.forEach((boardId, index) => {
      const board = this.projectData.boards[boardId];
      const title = board ? (board.title || board.name || boardId) : boardId;
      const isLast = index === this.historyStack.length - 1;

      const item = document.createElement('div');
      item.className = `breadcrumb-item ${isLast ? 'active' : ''}`;
      item.textContent = title;
      item.addEventListener('click', () => {
        if (!isLast) this.navigateToBoard(boardId);
      });
      container.appendChild(item);

      if (!isLast) {
        const sep = document.createElement('span');
        sep.className = 'breadcrumb-separator';
        sep.textContent = '>';
        container.appendChild(sep);
      }
    });

    // 🎯 서브 보드(폴더)에 진입한 상태일 때: 상위 이동 버튼 및 폴더 삭제 버튼 제공
    const currentBoardId = this.getCurrentBoardId();
    if (currentBoardId !== 'root') {
      const btnGroup = document.createElement('div');
      btnGroup.style.display = 'inline-flex';
      btnGroup.style.alignItems = 'center';
      btnGroup.style.gap = '6px';
      btnGroup.style.marginLeft = '12px';

      const backBtn = document.createElement('button');
      backBtn.className = 'btn';
      backBtn.style.padding = '0 8px';
      backBtn.style.height = '28px';
      backBtn.style.fontSize = '11px';
      backBtn.style.background = 'rgba(30, 41, 59, 0.85)';
      backBtn.style.borderColor = '#475569';
      backBtn.style.whiteSpace = 'nowrap';
      backBtn.innerHTML = '⬆️ 상위';
      backBtn.title = '상위 보드로 이동';
      backBtn.onclick = () => this.navigateBack();
      btnGroup.appendChild(backBtn);

      const delBtn = document.createElement('button');
      delBtn.className = 'btn btn-danger';
      delBtn.style.padding = '0 8px';
      delBtn.style.height = '28px';
      delBtn.style.fontSize = '11px';
      delBtn.style.background = 'rgba(239, 68, 68, 0.2)';
      delBtn.style.borderColor = 'rgba(239, 68, 68, 0.5)';
      delBtn.style.color = '#f87171';
      delBtn.style.whiteSpace = 'nowrap';
      delBtn.innerHTML = '🗑️ 폴더 삭제';
      delBtn.title = '현재 하위 캔버스(폴더) 영구 삭제';
      delBtn.onclick = () => {
        if (window.app && window.app.deleteBoardById) {
          window.app.deleteBoardById(currentBoardId);
        }
      };
      btnGroup.appendChild(delBtn);

      container.appendChild(btnGroup);
    }
  }
}
