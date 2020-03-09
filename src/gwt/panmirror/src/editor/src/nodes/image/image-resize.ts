/*
 * image-resize.ts
 *
 * Copyright (C) 2019-20 by RStudio, PBC
 *
 * Unless you have received this program directly from RStudio pursuant
 * to the terms of a commercial license agreement with RStudio, then
 * this program is licensed to you under the terms of version 3 of the
 * GNU Affero General Public License. This program is distributed WITHOUT
 * ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
 * MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
 * AGPL (http://www.gnu.org/licenses/agpl-3.0.txt) for more details.
 *
 */

import { EditorView } from 'prosemirror-view';
import { NodeWithPos } from 'prosemirror-utils';
import { NodeSelection } from 'prosemirror-state';

import { createPopup, createHorizontalPanel, addHorizontalPanelCell } from '../../api/widgets';

export function initResizeContainer(container: HTMLElement) {

  // add standard parent class
  container.classList.add('pm-image-resize-container', 'pm-selected-node-outline-color');

  // so that we are the offsetParent for the resize handles and shelf
  container.style.position = 'relative';

  // so that the container matches the size of the contained image
  container.style.display = 'inline-block';

  // so that the handles and shelf can be visible outside the boundaries of the image
  container.style.overflow = 'visible';

  // return for convenience
  return container;
}

export function attachResizeUI(
  container: HTMLElement,
  img: HTMLImageElement,
  view: EditorView,
  getNodeWithPos: () => NodeWithPos,
) {

  container.classList.add('pm-image-resize-active');

  // create resize shelf
  const popup = createPopup(view, []);
  popup.style.left = '0';
  popup.style.bottom = '-45px';
  // TODO: min width that inspects image width (i.e might have to set right to a negative value)
  popup.style.right = '0';
  container.append(popup);
  const panel = createHorizontalPanel();
  popup.append(panel);
  const label = document.createElement('span');
  label.innerHTML = "&nbsp;";
  addHorizontalPanelCell(panel, label);


  // create bottom right handle
  const handle = document.createElement('span');
  handle.classList.add(
    'pm-image-resize-handle', 
    'pm-background-color', 
    'pm-selected-node-border-color'
  );
  handle.style.position = 'absolute';
  handle.style.bottom = '-6px';
  handle.style.right = '-6px';
  handle.style.cursor = 'nwse-resize';

  const havePointerEvents = !!document.body.setPointerCapture;  

  const onPointerDown = (ev: MouseEvent) => {
    ev.preventDefault();

    const startWidth = img.offsetWidth;
    const startHeight = img.offsetHeight;

    const startX = ev.pageX;
    const startY = ev.pageY;

    const onPointerMove = (e: MouseEvent) => {

      // detect pointer movement
      const movedX = e.pageX - startX;
      const movedY = e.pageY - startY;

      const lockRatio = true;
      if (lockRatio) {
        if (movedX >= movedY) {
          img.style.width = startWidth + movedX + 'px'; 
          img.style.height = startHeight + (movedX * (startHeight/startWidth)) + 'px';
        } else {
          img.style.height = startHeight + movedY + 'px';
          img.style.width = startWidth + (movedY * (startWidth/startHeight)) + 'px';
        }
      } else {
        img.style.width = startWidth + movedX + 'px';
        img.style.height = startHeight + movedY + 'px';
      }      
    };

    const onPointerUp = (e: MouseEvent) => {
      e.preventDefault();

      // stop listening to events
      if (havePointerEvents) {
        handle.releasePointerCapture((e as PointerEvent).pointerId);
        handle.removeEventListener('pointermove', onPointerMove);
        handle.removeEventListener('pointerup', onPointerUp);
      } else {
        document.removeEventListener('mousemove', onPointerMove);
        document.removeEventListener('mouseup', onPointerUp);
      }
      
      // get node and position
      const { pos, node } = getNodeWithPos();

      // edit width & height in keyvalue
      let keyvalue = node.attrs.keyvalue as Array<[string, string]>;
      keyvalue = keyvalue.filter(value => !['width', 'height'].includes(value[0]));
      keyvalue.push(['width', img.width.toString()]);
      keyvalue.push(['height', img.height.toString()]);

      // create transaction
      const tr = view.state.tr;

      // set new attributes
      tr.setNodeMarkup(pos, node.type, { ...node.attrs, keyvalue });

      // restore node selection if our tr.setNodeMarkup blew away the selection
      const prevState = view.state;
      if (prevState.selection instanceof NodeSelection && prevState.selection.from === pos) {
        tr.setSelection(NodeSelection.create(tr.doc, pos));
      }

      // dispatch transaction
      view.dispatch(tr);
    };

    if (havePointerEvents) {
      handle.setPointerCapture((ev as PointerEvent).pointerId);
      handle.addEventListener('pointermove', onPointerMove);
      handle.addEventListener('pointerup', onPointerUp);
    } else {
      document.addEventListener('mousemove', onPointerMove);
      document.addEventListener('mouseup', onPointerUp);
    }
    
  };

  if (havePointerEvents) {
    handle.addEventListener('pointerdown', onPointerDown);
  } else {
    handle.addEventListener('mousedown', onPointerDown);
  }
  
  // append the handle
  container.append(handle);

  // return a function that can be used to destroy the resize UI
  return () => {
    container.classList.remove('pm-image-resize-active');
    handle.remove();
    popup.remove();
  };
}