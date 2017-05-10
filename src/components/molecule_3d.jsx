import jQuery from 'jquery';
import React from 'react';
import libUtils from '../utils/lib_utils';
import moleculeUtils from '../utils/molecule_utils';
import selectionTypesConstants from '../constants/selection_types_constants';

window.$ = jQuery;
const $3Dmol = require('3dmol');

const DEFAULT_FONT_SIZE = 14;
const ORBITAL_COLOR_POSITIVE = 0xff0000;
const ORBITAL_COLOR_NEGATIVE = 0x0000ff;

$3Dmol.VolumeData.prototype.volume = function (volume) {
  this.size = new $3Dmol.Vector3(volume.dimensions[0],
                                 volume.dimensions[1],
                                 volume.dimensions[2]);
  this.origin = new $3Dmol.Vector3(volume.origin[0],
                                   volume.origin[1],
                                   volume.origin[2]);
  this.unit = new $3Dmol.Vector3(volume.spacing[0],
                                 volume.spacing[1],
                                 volume.spacing[2]);
  this.data = new Float32Array(volume.scalars);
};

class Molecule3d extends React.Component {
  static defaultProps = {
    atomLabelsShown: false,
    backgroundOpacity: 1.0,
    backgroundColor: '#73757c',
    height: '500px',
    onRenderNewData: () => {},
    orbital: {},
    volume: {},
    isoSurfaces: [],
    selectedAtomIds: [],
    selectionType: selectionTypesConstants.ATOM,
    shapes: [],
    styles: {},
    style: {
      stick: {
        radius: 0.14,
      },
      sphere: {
        scale: 0.3,
      },
    },
    width: '500px',
  }

  static propTypes = {
    atomLabelsShown: React.PropTypes.bool,
    backgroundColor: React.PropTypes.string,
    backgroundOpacity: React.PropTypes.number,
    height: React.PropTypes.string,
    modelData: React.PropTypes.shape({
      atoms: React.PropTypes.array,
      bonds: React.PropTypes.array,
    }).isRequired,
    onChangeSelection: React.PropTypes.func,
    onRenderNewData: React.PropTypes.func,
    orbital: React.PropTypes.shape({
      cube_file: React.PropTypes.string,
      iso_val: React.PropTypes.number,
      opacity: React.PropTypes.number,
    }),
    volume: React.PropTypes.shape({
      size: React.PropTypes.arrayOf(React.PropTypes.number),
      origin: React.PropTypes.arrayOf(React.PropTypes.number),
      unit: React.PropTypes.arrayOf(React.PropTypes.number),
      data: React.PropTypes.objectOf(Float32Array),
    }),
    isoSurfaces: React.PropTypes.objectOf(React.PropTypes.shape({
      color: React.PropTypes.string,
      value: React.PropTypes.number,
      opacity: React.PropTypes.number,
      smoothness: React.PropTypes.number,
    })),
    selectedAtomIds: React.PropTypes.arrayOf(React.PropTypes.number),
    selectionType: React.PropTypes.oneOf([
      selectionTypesConstants.ATOM,
      selectionTypesConstants.RESIDUE,
      selectionTypesConstants.CHAIN,
    ]),
    shapes: React.PropTypes.arrayOf(React.PropTypes.object),
    style: React.PropTypes.objectOf(React.PropTypes.object),
    styles: React.PropTypes.objectOf(React.PropTypes.object),
    width: React.PropTypes.string,
  }

  static isModelDataEmpty(modelData) {
    return modelData.atoms.length === 0 && modelData.bonds.length === 0;
  }

  static render3dMolModel(glviewer, modelData) {
    glviewer.clear();

    if (Molecule3d.isModelDataEmpty(modelData)) {
      return;
    }

    glviewer.addModel(moleculeUtils.modelDataToCDJSON(modelData), 'json', {
      keepH: true,
    });

    // Hack in chain and residue data, since it's not supported by chemdoodle json
    glviewer.getModel().selectedAtoms().forEach((atom) => {
      const modifiedAtom = atom;
      modifiedAtom.atom = modelData.atoms[atom.serial].name;
      modifiedAtom.chain = modelData.atoms[atom.serial].chain;
      modifiedAtom.resi = modelData.atoms[atom.serial].residue_index;
      modifiedAtom.resn = modelData.atoms[atom.serial].residue_name;
    });
  }

  static render3dMolShapes(glviewer, shapes) {
    glviewer.removeAllShapes();
    shapes.forEach((shape) => {
      if (shape.type) {
        glviewer[`add${shape.type}`](libUtils.getShapeSpec(shape));
      }
    });
  }

  static render3dMolOrbital(glviewer, orbital) {
    if (orbital.cube_file) {
      const volumeData = new $3Dmol.VolumeData(orbital.cube_file, 'cube');
      glviewer.addIsosurface(volumeData, {
        isoval: orbital.iso_val,
        color: ORBITAL_COLOR_POSITIVE,
        opacity: orbital.opacity,
      });
      glviewer.addIsosurface(volumeData, {
        isoval: -orbital.iso_val,
        color: ORBITAL_COLOR_NEGATIVE,
        opacity: orbital.opacity,
      });
    }
  }

  static render3dMolIsoSurfaces(glviewer, volume, isoSurfaces) {
    console.log('isoSurface');
    console.log(isoSurfaces);
    if (volume) {
      const volumeData = new $3Dmol.VolumeData(volume, 'volume');

      isoSurfaces.forEach((isoSurface) => {
        const iso = {
          isoval: isoSurface.value,
          color: isoSurface.color,
          opacity: isoSurface.opacity,
        };

        if ('smoothness' in isoSurface) {
          console.log(isoSurface.smoothness);
          iso.smoothness = isoSurface.smoothness;
        }
        glviewer.addIsosurface(volumeData, iso);
      });
    }
  }

  constructor(props) {
    super(props);

    this.state = {
      selectedAtomIds: props.selectedAtomIds,
    };
  }

  componentDidMount() {
    this.render3dMol();
  }

  componentWillReceiveProps(nextProps) {
    this.setState({
      selectedAtomIds: nextProps.selectedAtomIds,
    });
  }

  componentDidUpdate() {
    this.render3dMol();
  }

  onClickAtom = (glAtom) => {
    const atoms = this.props.modelData.atoms;
    const atom = atoms[glAtom.serial];
    const selectionType = this.props.selectionType;
    const newSelectedAtomIds = moleculeUtils.addSelection(
      atoms,
      this.state.selectedAtomIds,
      atom,
      selectionType
    );

    this.setState({
      selectedAtomIds: newSelectedAtomIds,
    });

    if (this.props.onChangeSelection) {
      this.props.onChangeSelection(newSelectedAtomIds);
    }
  }

  render3dMol() {
    if (!this.glviewer && Molecule3d.isModelDataEmpty(this.props.modelData)) {
      return;
    }

    const glviewer = this.glviewer || $3Dmol.createViewer(jQuery(this.container), {
      defaultcolors: $3Dmol.elementColors.rasmol,
    });

    const renderingSameModelData = moleculeUtils.modelDataEquivalent(
      this.oldModelData, this.props.modelData
    );
    if (!renderingSameModelData) {
      this.lastStylesByAtom = null;
      Molecule3d.render3dMolModel(glviewer, this.props.modelData);
    }

    const styleUpdates = Object.create(null); // style update strings to atom ids needed
    const stylesByAtom = Object.create(null); // all atom ids to style string
    this.props.modelData.atoms.forEach((atom, i) => {
      const selected = this.state.selectedAtomIds.indexOf(atom.serial) !== -1;
      const libStyle = libUtils.getLibStyle(
        atom, selected, this.props.atomLabelsShown, this.props.styles[i]
      );

      if (this.props.atomLabelsShown) {
        glviewer.addLabel(atom.name, {
          fontSize: DEFAULT_FONT_SIZE,
          position: {
            x: atom.positions[0],
            y: atom.positions[1],
            z: atom.positions[2],
          },
        });
      }

      const libStyleString = JSON.stringify(libStyle);
      stylesByAtom[atom.serial] = libStyleString;

      // If the style string for this atom is the same as last time, then no
      // need to set it again
      if (this.lastStylesByAtom &&
        this.lastStylesByAtom[atom.serial] === libStyleString) {
        return;
      }

      // Initialize list of atom serials for this style string, if needed
      if (!styleUpdates[libStyleString]) {
        styleUpdates[libStyleString] = [];
      }

      styleUpdates[libStyleString].push(atom.serial);
    });

    this.lastStylesByAtom = stylesByAtom;

    // Set these style types using a minimum number of calls to 3DMol
    if (this.props.style) {
      glviewer.setStyle({}, this.props.style);
    } else {
      Object.entries(styleUpdates).forEach(([libStyleString, atomSerials]) => {
        glviewer.setStyle(
          { serial: atomSerials }, JSON.parse(libStyleString)
        );
      });
    }

    if (!this.props.atomLabelsShown) {
      glviewer.removeAllLabels();
    }

    Molecule3d.render3dMolShapes(glviewer, this.props.shapes);
    Molecule3d.render3dMolOrbital(glviewer, this.props.orbital);
    Molecule3d.render3dMolIsoSurfaces(glviewer, this.props.volume,
                                      this.props.isoSurfaces);

    glviewer.setBackgroundColor(
      libUtils.colorStringToNumber(this.props.backgroundColor),
      this.props.backgroundOpacity
    );

    glviewer.setClickable({}, true, this.onClickAtom);
    glviewer.render();

    if (!this.oldModelData) {
      glviewer.zoom();
      glviewer.zoomTo(0.8);
    }

    if (!renderingSameModelData) {
      glviewer.fitSlab();
      this.props.onRenderNewData(glviewer);
    }

    this.oldModelData = this.props.modelData;
    this.glviewer = glviewer;
  }

  render() {
    return (
      <div
        className="molecule-3d"
        style={{
          width: this.props.width,
          height: this.props.height,
          position: 'relative',
          margin: '0 auto',
        }}
        ref={(c) => { this.container = c; }}
      />
    );
  }
}

export default Molecule3d;
