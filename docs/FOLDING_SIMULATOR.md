# Folding simulator prototype

Open **Folding simulator** from the header. It works without a book. Select a line on the paper, choose a side by tapping or hovering, and drag the paper to preview the fold. The curved arrow shows its direction and a dashed outline shows the landing position. **Fold / Cancel** stays beside the paper. Clicking a folded edge selects an exposed flap for unfolding. A fold is only recorded after confirmation.

The app selects an exposed flap by default; Visible flap buttons appear when alternatives exist, including options that require turning in the opposite direction. Hovering a button highlights its moving paper; labels distinguish the near and far sides. **Undo** removes an edit, while physically unfolding records a new step. **Rotate left / right** turns the view by 90° without changing the visible face and records that orientation as a view step. **Turn over** shows the other face. Drag the background to orbit. Use **Pan** for mouse or one-finger dragging without folding; Shift-drag and right-drag also pan. Exact crease, packet and angle controls remain available under **Advanced** as a keyboard-accessible alternative.

The **Steps** drawer is collapsed initially. Steps are recorded automatically and can be replayed, annotated or supplemented with camera views. Adding a step while rewound replaces later draft steps; Undo restores them. The **Methods** menu holds named saves, the example, import and export. Named methods change only when saved; the current draft autosaves separately. JSON recordings contain no book content. Video export uses a browser-supported format, includes captions and runs locally.

The three-fold example is illustrative, not a verified reading method.

## Model and limits

The pure TypeScript model stores exact flat endpoints for sixteen connected rectangular panels. Original front/back faces keep stable labels. Letter dimensions are applied by the Three.js view. Recorded folds include the current axis, source hinge identities, moving panel IDs and sweep direction; version 1 recordings replay and validate every action on import.

Removing connections along a candidate axis produces possible flaps. Connected panels or packets in face contact can rotate only when entirely on one side of that axis. Layer order prevents departing through covering stationary faces. All stationary faces remain in the original plane, while the moving packet sweeps strictly through one open half-space; this restricted model avoids mid-sweep intersections without a general collision solver. Final stacking reverses the moving layers. Shaded faces, solid edges and curved connections make the stack visible. Layer spacing and thickness are deliberately exaggerated; **Spread layers** increases the gaps for inspection. These are visual aids, not physical paper thickness or an elastic simulation. Fold animation settles into the destination stack heights without an endpoint jump.

There are no cuts, diagonal folds, elastic bends, or actions starting from a partly open packet. Stiffness, friction and real paper thickness are not simulated. A missing move may be a prototype limitation, not an impossible physical fold. Add a note describing the obstruction and export the recording so it can be investigated.

## Local validation

Model tests cover the 4×4 → 4×2 → 4×1 → 2×1 sequence, shared-edge continuity, unfolding, layer access and recording validation. Browser tests cover actual WebGL output, editing/replay, persistence, imports, decodable video, cancellation, mobile controls and preserving the book workspace.

The next physical check is to reproduce the user's reading transitions, not merely the initial three folds. Actual PDF faces and verified tutorial methods are deferred until that workflow is useful. The simulator ships as an experimental feature in 2.3.0; these physical-model limits still apply.
