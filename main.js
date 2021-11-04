/**
 *  Some missing functions
 */

/**
 * @param {number} idx
 * @returns [0, 1, ..., idx - 1]
 */
const range = (idx) => Array.from({ length: idx }).map((_, i) => i);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// const __nj_array = nj.array;
// nj.array = (_, __) => __nj_array(_, "float32");

/**
 * Main definition about *drawables*
 */

class VMobject {
  ppc = 3;
  dim = 2;
  // NumJs Array Nx3
  points = nj.array([]);

  copy() {
    let copy = new VMobject();
    copy.set_points(this.points.clone());
    return copy;
  }

  clear_points() {
    this.points = nj.array([]);
  }

  get_points_at(index) {
    return nj.array(range(this.dim).map((i) => this.points.get(index, i)));
  }

  get_num_points() {
    return this.points.size / this.dim;
  }

  set_points(points) {
    this.points = nj.array(points);
  }

  append_points(points) {
    if (Array.isArray(points)) {
      // nj.array() cannot process Array<NJArray>
      points = nj.stack(points);
    }
    points = nj.array(points);
    let a = this.points.flatten();
    let b = points.flatten();
    let c = nj.concatenate(a, b);
    this.points = c.reshape(c.size / this.dim, this.dim);
  }

  last_point() {
    return nj.array(range(this.dim).map((i) => this.points.get(-1, i)));
  }

  interpolate(p0, p1, t) {
    return p0.multiply(1 - t).add(p1.multiply(t));
  }

  // transform
  apply(f) {
    for (let i = 0; i < this.get_num_points(); i++) {
      let p = this.get_points_at(i);
      let new_p = f(p);
      range(this.dim).map((dimIdx) => {
        this.points.set(i, dimIdx, new_p.get(dimIdx));
      });
    }
  }

  rotate(angle) {
    this.apply((p) => {
      let x = p.get(0);
      let y = p.get(1);
      let s = Math.sin(angle);
      let c = Math.cos(angle);
      return nj.array([c * x - s * y, s * x + c * y]);
    });
  }

  scale(xf, yf) {
    this.apply((p) => {
      return nj.array([p.get(0) * xf, p.get(1) * yf]);
    });
  }

  translate(dx, dy) {
    this.apply((p) => {
      return nj.array([p.get(0) + dx, p.get(1) + dy]);
    });
  }

  // style
  fill = nj.array([0, 0, 0, 0]);
  stroke = nj.array([1, 1, 1, 1]);

  /**
   * @param {number[]} arr
   */
  _array2css(arr) {
    const clamp = (x, a, b) => Math.min(Math.max(x, a), b);
    return (
      "#" +
      arr
        .map((n) => Math.floor(clamp(n, 0, 1) * 255))
        .map((n) => n.toString(16))
        .map((s) => (s.length == 1 ? "0" : "") + s)
        .join("")
    );
  }

  getFillStyle() {
    return this._array2css(this.fill.tolist());
  }

  getStrokeStyle() {
    return this._array2css(this.stroke.tolist());
  }

  // drawing
  moveTo(point) {
    point = nj.array(point);
    this.append_points([point]);
  }

  lineTo(point) {
    point = nj.array(point);
    let start = this.last_point();
    let half = this.interpolate(start, point, 0.5);
    if (this.get_num_points() % this.ppc == 1) {
      this.append_points([half, point]);
    } else {
      this.append_points([start, half, point]);
    }
  }

  bezierTo(control_point, point) {
    point = nj.array(point);
    control_point = nj.array(control_point);
    let start = this.last_point();
    if (this.get_num_points() % this.ppc == 1) {
      this.append_points([control_point, point]);
    } else {
      this.append_points([start, control_point, point]);
    }
  }

  closed = false;
  closePath() {
    this.lineTo(this.get_points_at(0));
    this.closed = true;
  }

  get_bezier_points(i) {
    i = i % this.get_num_points();
    return [
      this.get_points_at(i),
      this.get_points_at(i + 1),
      this.get_points_at(i + 2),
    ];
  }

  resize(length) {
    if (length <= this.get_num_points()) return;

    let every = Math.floor(length / this.get_num_points());
    let additional = (length - every * this.get_num_points()) / 3;

    let points = [];
    for (let i = 0; i < this.get_num_points() / this.ppc; i++) {
      let a = this.get_points_at(i * 3);
      let b = this.get_points_at(i * 3 + 1);
      let c = this.get_points_at(i * 3 + 2);

      let to = every + (i < additional ? 1 : 0);

      let cut = 1 / to;
      for (let j = 0; j < to; j++) {
        let start = j * cut;
        let end = (j + 1) * cut;

        let p1 = this.interpolate(a, c, start);
        let p2 = this.interpolate(a, c, end);
        let p3 = this.interpolate(p1, p2, 0.5);
        points.push(p1.tolist(), p3.tolist(), p2.tolist());
      }
    }

    // console.log(points)
    points = nj.array(points);
    this.set_points(points);
    return;

    while (true) {
      if (this.get_num_points() == length) return;
      this.append_points(this.last_point());
    }
  }
}

class Rectangle extends VMobject {
  constructor(w, h, x, y) {
    super();
    this.moveTo([x - w / 2, y + h / 2]);
    this.lineTo([x + w / 2, y + h / 2]);
    this.lineTo([x + w / 2, y - h / 2]);
    this.lineTo([x - w / 2, y - h / 2]);
    this.closePath();
  }
}

class Square extends Rectangle {
  constructor(x = 0, y = 0, side_len = 200) {
    super(side_len, side_len, x, y);
  }
}

class Trans extends VMobject {
  /**
   *
   * @param {VMobject} a
   * @param {VMobject} b
   */
  constructor(a, b, t = 0) {
    super();
    this.a = a;
    this.b = b;
    this.closed = a.closed && b.closed;
    this.update(t);
  }

  update(t) {
    this.clear_points();

    this.fill = this.interpolate(this.a.fill, this.b.fill, t);
    this.stroke = this.interpolate(this.a.stroke, this.b.stroke, t);

    if (this.a.get_num_points() > this.b.get_num_points()) {
      this.b.resize(this.a.get_num_points());
    } else {
      this.a.resize(this.b.get_num_points());
    }
    this.points = nj.zeros([this.a.get_num_points(), this.dim]);
    // let start = new Date().getTime();
    for (let i = 0; i < this.a.get_num_points(); i++) {
      let c = this.interpolate(
        this.a.get_points_at(i),
        this.b.get_points_at(i),
        t
      );
      range(this.dim).map((idx) => this.points.set(i, idx, c.get(idx)));
      // this.append_points(c);
    }
    // console.log(this.points)
    // let end = new Date().getTime();
    // console.log(`==== ${end - start}`);
  }
}

class FadeOut extends VMobject {
  constructor(obj) {
    super();
    this.obj = obj;
    this.set_points(this.obj.points);
  }

  update(t) {
    this.fill = this.interpolate(
      this.obj.fill,
      nj.array([...this.obj.fill.tolist().slice(0, 3), 0]),
      t
    );
    this.stroke = this.interpolate(
      this.obj.stroke,
      nj.array([...this.obj.stroke.tolist().slice(0, 3), 0]),
      t
    );
  }
}

class PartialObject extends VMobject {
  /**
   * @param {VMobject} obj
   * @param {number} t
   */
  constructor(obj, t = 0) {
    super();
    this.obj = obj;
    this.obj.resize(300);
    this.opaque_stroke = nj.array([
      ...obj.stroke.tolist().slice(0, 3),
      obj.stroke.get(3) == 0 ? 1 : obj.stroke.get(3),
    ]);
    this.tranparent_fill = nj.array([...obj.fill.tolist().slice(0, 3), 0]);
    this.update(t);
  }

  update(t) {
    let num = Math.ceil(this.obj.get_num_points() * t);
    num -= num % 3;
    let partial = this.obj.points
      .flatten()
      .slice([0, num * 2])
      .reshape([num, 2]);
    this.set_points(partial);

    if (t <= 1) {
      this.fill = this.interpolate(
        this.tranparent_fill,
        this.obj.fill,
        Math.pow(t, 20)
      );
      this.stroke = this.interpolate(
        this.opaque_stroke,
        this.obj.stroke,
        Math.pow(t, 20)
      );
    }

    if (t >= 1) {
      this.closed = true;
      this.fill = this.obj.fill;
      this.stroke = this.obj.stroke;
    }
  }
}

class Circle extends VMobject {
  constructor() {
    super();
    let split = 40;

    let start = Math.PI;
    let cut = (Math.PI * 2) / split;
    let to = start;
    let rx = 100;
    let ry = 100;
    this.moveTo([Math.cos(to) * rx, Math.sin(to) * ry]);
    for (let i = 0; i < split - 1; i++) {
      let to = start - cut;
      this.lineTo([Math.cos(to) * rx, Math.sin(to) * ry]);
      start = to;
    }
    this.closePath();
  }
}

class Line extends VMobject {
  constructor(from, to) {
    super();
    this.setLine(from, to);
  }

  setLine(from, to) {
    this.points = nj.array([]);

    let f = nj.array(from);
    let t = nj.array(to);

    this.moveTo(f.tolist());
    this.lineTo(t.tolist());
    let v = t.subtract(f);
    let len = Math.sqrt(nj.dot(v, v).get(0)) * 0.1;
    let angle = Math.atan2(v.get(1), v.get(0));
    len = 20;
    this.resize(300);

    let tip = new VMobject();
    tip.moveTo([-len, 0]);
    tip.lineTo([0, len * 2]);
    tip.lineTo([len, 0]);
    tip.closePath();
    tip.rotate(angle - Math.PI / 2);
    tip.translate(t.get(0), t.get(1));

    tip.resize(300);
    this.append_points(tip.points);
    this.fill = nj.array([1, 1, 1, 1]);
  }
}

class VectorSpace extends VMobject {
  constructor(basis1, basis2) {
    super();
    this.setBasis(basis1, basis2);
  }

  setBasis(basis1, basis2) {
    let start = new Date().getTime();
    this.points = nj.zeros([3 * (21 * 20) * 2, this.dim]);
    let idx = 0;
    for (let i = -10; i < 10; i++) {
      for (let j = 10; j >= -10; j--) {
        let from = basis1.multiply(i).add(basis2.multiply(j));
        let to = basis1.multiply(i + 1).add(basis2.multiply(j));
        let half = this.interpolate(from, to, 0.5);
        range(this.dim).forEach((dimIdx) =>
          this.points.set(idx, dimIdx, from.get(dimIdx))
        );
        idx++;
        range(this.dim).forEach((dimIdx) =>
          this.points.set(idx, dimIdx, half.get(dimIdx))
        );
        idx++;
        range(this.dim).forEach((dimIdx) =>
          this.points.set(idx, dimIdx, to.get(dimIdx))
        );
        idx++;
        // this.append_points([from, half, to]);
        // this.moveTo(from.tolist());
        // this.lineTo(to.tolist());
      }
    }

    // this.resize(this.get_num_points() * 2);
    for (let i = -10; i < 10; i++) {
      for (let j = 10; j >= -10; j--) {
        let from = basis2.multiply(i).add(basis1.multiply(j));
        let to = basis2.multiply(i + 1).add(basis1.multiply(j));
        let half = this.interpolate(from, to, 0.5);
        range(this.dim).forEach((dimIdx) =>
          this.points.set(idx, dimIdx, from.get(dimIdx))
        );
        idx++;
        range(this.dim).forEach((dimIdx) =>
          this.points.set(idx, dimIdx, half.get(dimIdx))
        );
        idx++;
        range(this.dim).forEach((dimIdx) =>
          this.points.set(idx, dimIdx, to.get(dimIdx))
        );
        idx++;
        // this.moveTo(from.tolist());
        // this.lineTo(to.tolist());
      }
    }
    let end = new Date().getTime();
    console.log(`${end - start}`);
  }
}
class Tex extends VMobject {
  constructor(text) {
    super();
    this.setText(text);
  }

  path2vmobject(commands) {
    // first, parse string to formatted data
    const findNext = (candicates, start) => {
      while (true) {
        start++;
        if (start >= commands.length) return start;
        if (candicates.includes(commands[start])) {
          return start;
        } else {
        }
      }
    };
    let i = 0;
    let formattedCommands = [];
    while (i < commands.length) {
      let last = i;
      i = findNext("MLHVCTQZ", i);
      let type = commands[last];
      let data = commands
        .slice(last + 1, i)
        .split(" ")
        .filter((x) => x != "")
        .map(parseFloat);
      formattedCommands.push({ type, data });
    }

    // console.log(formattedCommands);
    // next, generate points from formatted data
    let transformedCommands = [];
    let __control_point;

    let obj = new VMobject();

    formattedCommands.forEach((c, i) => {
      const { type, data } = c;
      let __last = transformedCommands[transformedCommands.length - 1];
      let trans = (() => {
        switch (type) {
          case "M":
            obj.moveTo(data);
          case "L":
            obj.lineTo(data);
            return { type, x: data[0], y: data[1] };
          case "H":
            obj.lineTo([data[0], __last.y]);
            return { type: "L", x: data[0], y: __last.y };
          case "V":
            obj.lineTo([__last.x, data[0]]);
            return { type: "L", y: data[0], x: __last.x };
          case "Q":
            __control_point = [data[0], data[1]];
            obj.bezierTo([data[0], data[1]], [data[2], data[3]]);
            return { type, x1: data[0], y1: data[1], x: data[2], y: data[3] };
          case "T":
            let a = [__last.x, __last.y];
            let c = __control_point;
            let diff = nj.array(c).subtract(a);
            __control_point = nj.array(a).subtract(diff).tolist();
            obj.bezierTo(__control_point, data);
            return {
              type: "Q",
              x1: __control_point[0],
              y1: __control_point[1],
              x: data[0],
              y: data[1],
            };
          case "Z":
            // TODO: TRICKY...
            // obj.closePath();
            return { type };
          default:
            console.log(`UNKNOWN ${type}`);
            return null;
        }
      })();

      if (trans) {
        transformedCommands.push(trans);
      }
    });

    return obj;
  }

  tex2svg(text) {
    let mjdiv = MathJax.tex2svg(text);
    let svg = mjdiv.children[0];
    return svg;
  }

  svg2vmobject(svg) {
    let viewBox = svg.getAttribute("viewBox").split(" ").map(parseFloat);
    let [defs, g] = svg.children;

    const id2commands = {};
    Array.from(defs.children).forEach((path) => {
      id2commands[path.id] = this.path2vmobject(path.getAttribute("d"));
    });

    const group2node = (group) => {
      let type = group.nodeName;
      let transformString = group.getAttribute("transform");
      let translate = (
        /translate\((.+),(.+)\)/.exec(transformString) || [0, 0, 0]
      )
        .slice(1, 3)
        // @ts-ignore
        .map(parseFloat);

      // NO NEED IN NEW IMPLEMENTATION
      // TODO: WHY I NEED THIS TO MAKE IT LOOKS RIGHT...
      // translate[1] = -translate[1];

      /** @type{any} */
      let firsttry = /scale\((.+),(.+)\)/.exec(transformString);
      if (!firsttry) {
        firsttry = /scale\((.+)\)/.exec(transformString);
        if (firsttry) {
          firsttry = [firsttry[1], firsttry[1]];
        }
      } else {
        firsttry = firsttry.slice(1, 3);
      }
      if (!firsttry) {
        firsttry = [1, 1];
      } else {
        firsttry = firsttry.map(parseFloat);
      }
      // let scale = (/scale\((.+),(.+)\)/.exec(transformString) || [0, 1, 1])
      //   .slice(1, 3)
      //   .map(parseFloat);
      let scale = firsttry;
      if (type == "g") {
        let nodes = Array.from(group.children).map(group2node);

        let vmobject = new VMobject();

        nodes.forEach((n) => {
          if (!n.nodes) {
            vmobject.append_points(n.points);
          } else {
            vmobject.append_points(n.vmobject.points);
          }
        });
        vmobject.scale(scale[0], scale[1]);
        vmobject.translate(translate[0], translate[1]);

        return {
          nodes,
          translate,
          // scale: [1,-1]
          scale,
          vmobject,
        };
      } else if (type == "use") {
        let id = group.getAttribute("xlink:href");
        let vmobject = id2commands[id.slice(1)].copy();
        vmobject.scale(scale[0], scale[1]);
        vmobject.translate(translate[0], translate[1]);
        return vmobject;
      } else if (type == "rect") {
        let width = parseFloat(group.getAttribute("width"));
        let height = parseFloat(group.getAttribute("height"));
        let x = parseFloat(group.getAttribute("x"));
        let y = parseFloat(group.getAttribute("y"));
        // return new VMobject();
        let rect = new Rectangle(width, height, x + width / 2, y + height / 2);
        return rect;
      } else {
        console.log(`SVG. Unknown group: ${group}`);
        console.log(group);
        return new VMobject();
      }
    };

    let svgNode = group2node(g);
    // Centerize: move half of width
    svgNode.translate = [-viewBox[2] / 2, 0];
    svgNode.scale = [1, -1];

    svgNode.vmobject.scale(1, -1);
    svgNode.vmobject.translate(-viewBox[2] / 2, 0);

    return [id2commands, svgNode];
  }
  setText(text) {
    let [id2commands, svgNode] = this.svg2vmobject(this.tex2svg(text));
    let mirror = svgNode.vmobject;
    this.set_points(mirror.points);
    this.scale(0.07, 0.07);
    this.stroke = nj.array([1, 1, 1, 0]);
    this.fill = nj.array([1, 1, 1, 1]);
  }
}

/**
 * Canvas Render
 */
const Renderer = (() => {
  let canvas = document.createElement("canvas");
  document.body.append(canvas);
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  let ctx = canvas.getContext("2d");

  /**
   * @param{VMobject} o
   */
  function renderVMObject(o) {
    const toCanvasCoord = (v) =>
      nj.array([v.get(0) + canvas.width / 2, -v.get(1) + canvas.height / 2]);

    let start = o.get_points_at(0);
    start = toCanvasCoord(start);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(start.get(0), start.get(1));
    let lastEnd = null;
    for (let i = 0; i < o.get_num_points() / o.ppc; i++) {
      let a = o.get_points_at(i * 3);
      a = toCanvasCoord(a);
      let b = o.get_points_at(i * 3 + 1);
      b = toCanvasCoord(b);
      let c = o.get_points_at(i * 3 + 2);
      c = toCanvasCoord(c);
      if (lastEnd) {
        if (nj.dot(lastEnd.subtract(a), lastEnd.subtract(a)).get(0) > 0.0001) {
          ctx.moveTo(a.get(0), a.get(1));
        }
      }
      lastEnd = c;
      ctx.quadraticCurveTo(b.get(0), b.get(1), c.get(0), c.get(1));
    }
    if (o.closed) {
      ctx.closePath();
    }

    ctx.strokeStyle = o.getStrokeStyle();
    ctx.fillStyle = o.getFillStyle();
    ctx.stroke();
    ctx.fill();
  }

  const play = async (updatable, time = 1, fps = 30) => {
    if (!Array.isArray(updatable)) {
      updatable = [updatable];
    }

    const ms = 1000 / fps;
    const frames = time * fps;
    let frame = -1;
    while (++frame <= frames) {
      let t = frame / frames;

      let beforeUpdate = new Date().getTime();
      updatable.forEach((u) => {
        if (u.update) {
          u.update(t);
        }
      });
      let afterUpdate = new Date().getTime();
      // console.log(`${afterUpdate - beforeUpdate}ms`);

      await sleep(ms - (afterUpdate - beforeUpdate));

      requestAnimationFrame(() => {
        Renderer.clear();
        updatable.forEach((u) => {
          if (u.points) {
            Renderer.renderVMObject(u);
          }
        });
      });
    }
  };

  return {
    renderVMObject,
    clear: () => {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    },
    play,
  };
})();

/**
 * Main
 */
(async function MainRenderFunction(play) {
  const SquareToCircle = async () => {
    let s = new Square();
    s.rotate(Math.PI / 4);
    let c = new Circle();
    c.fill = nj.array([0.7, 0.3, 0.4, 1]);
    c.stroke = nj.array([0.5, 0.1, 0.9, 1]);
    await play(new PartialObject(s));
    await play(new Trans(s, c));
    await play(new FadeOut(c));
  };

  const MatrixTransform = async () => {
    let basis1 = nj.array([100, 0]);
    let basis2 = nj.array([0, 100]);
    let vs = new VectorSpace(nj.array([100, 0]), nj.array([0, 100]));
    let v1 = new Line([0, 0], basis1);
    let v2 = new Line([0, 0], basis2);
    vs.stroke = nj.array([0.2, 0.5, 0.9, 0.4]);
    await play(new PartialObject(vs), 0.7);
    await play([
      vs,
      v1,
      v2,
      {
        update: (t) => {
          t = t * 10;
          basis1 = nj.array([100 * Math.cos(t), 100 * Math.sin(t)]);
          basis2 = nj.array([0, 100]);
          v1.setLine([0, 0], basis1);
          v2.setLine([0, 0], basis2);
          vs.setBasis(basis1, basis2);
        },
      },
    ]);
  };

  const Latex = async () => {
    let tex = new Tex(
      `\\int_{\\varphi}d\\omega = \\int_{\\partial\\varphi}\\omega`
    );
    await play(new PartialObject(tex));
  };

  await SquareToCircle();
  await sleep(1000);
  await MatrixTransform();
  await sleep(1000);
  await Latex();
  await sleep(1000);
})(Renderer.play);
