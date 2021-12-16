const unitWeightWater = 62.4; //pcf, constant

const TEXT_BOX_SIZE = 5;

//Terzaghi bearing capacity factors. key=phi, value=[Nc, Nq, Ng]
const NTerzaghi = {0:[5.7,1,0],
                1:[6,1.1,.1],
                2:[6.3,1.2,.1],
                3:[6.6,1.3,.2],
                4:[7,1.5,.3],
                5:[7.3,1.6,.4],
                6:[7.7,1.8,.5],
                7:[8.2,2,.6],
                8:[8.6,2.2,.7],
                9:[9.1,2.4,.9],
                10:[9.6,2.7,1],
                11:[10.2,3,1.2],
                12:[10.8,3.3,1.4],
                13:[11.4,3.6,1.6],
                14:[12.1,4,1.9],
                15:[12.9,4.4,2.2],
                16:[13.7,4.9,2.5],
                17:[14.6,5.5,2.9],
                18:[15.5,6,3.3],
                19:[16.6,6.7,3.8],
                20:[17.7,7.4,4.4],
                21:[18.9,8.3,5.1],
                22:[20.3,9.2,5.9],
                23:[21.7,10.2,6.8],
                24:[23.4,11.4,7.9],
                25:[25.1,12.7,9.2],
                26:[27.1,14.2,10.7],
                27:[29.2,15.9,12.5],
                28:[31.6,17.8,14.6],
                29:[34.2,20,17.1],
                30:[37.2,22.5,20.1],
                31:[40.4,25.3,23.7],
                32:[44,28.5,28],
                33:[48.1,32.2,33.3],
                34:[52.6,36.5,39.6],
                35:[57.8,41.4,47.3],
                36:[63.5,47.2,56.7],
                37:[70.1,53.8,68.1],
                38:[77.5,61.5,82.3],
                39:[86,70.6,99.8],
                40:[95.7,81.3,121.5],
                41:[106.8,93.8,148.5]};

class TerzaghiBearingCapacity {
    /*
    For more information on bearing capacity calculations, visit https://civilengineeringbible.com/subtopics.php?i=1

    GLOBAL VALUES
    This class only works with the unitWeightWater and NTerzaghi global values defined.
    unitWeightWater = 62.4 pounds per cubic foot [pcf]
    NTerzaghi = unitless, empirical values

    INPUT VALUES
    ---There is no data validation in the class itself. All data validation should be done in the UI.---
    cohesion: non-negative number (typically 0 to 4500) [pounds per square foot, psf]
    phi: integer from 0 to 41 (typically 28 to 35) [degrees]
    depth: embedment depth, non-negative number (3.5 is standard frost depth in MI) [feet]
    unitWeight: positive number (typically 100 to 140) [pounds per cubit foot, pcf]
    width: width of square or continous footing, or diameter of circular footing (typically >=1) [feet]
    shape: must be in ["square", "circular", "continuous"]. Bad input defaults to continuous
    groundwaterDepth: non-negative number, undefined or very large if no groundwater present [feet]
        If groundwaterDepth is undefined, constructor sets to 2*(depth+width) to get it out of influence zone
    FS: Factor of Safety, typically 2 for low risk structures, or 3 for higher risk structures. 

    CALCULATED VALUES
    All calculated values are calculated when the instance is constructed. None of the parameters should
    be modified after creating the instance. If the calculation needs to change, create a new instance.

    totalStress[psf] = unitWeight[pcf] * depth[ft]
    porePressure[psf] = (depth[ft] - groundwaterDepth[ft]) * unitWeightWater[pcf]
    effectiveStress[psf] = totalStress[psf] - porePressure[psf]
    Nc = bearing capacity factor for cohesion term = from lookup table
    Nq = bearing capacity factor for friction = from lookup table
    Ng = bearing capacity factor for effective stress = from lookup table
    coef1, coef2, coef3 = based on shape
    bearingCapacity[psf] = (coef1 * cohesion[psf] * Nc)+ (coef2 * effectiveStress[psf] * Nq) + (coef3 * effectiveUnitWeight[pcf] * width[ft] * Ng)
    allowableCapacity[psf] = bearingCapacity[psf] / FS
    equation = bearing capacity formula as a string, based on shape
    calculation = written out calculation as a string, based on equation
    */
    constructor(cohesion, phi, depth, unitWeight, width, shape, groundwaterDepth=undefined, FS) {
        this.cohesion = cohesion;
        this.phi = phi;
        this.depth = depth;
        this.unitWeight = unitWeight;
        this.width = width;
        this.shape = shape;
        this.groundwaterDepth = groundwaterDepth;
        this.FS = FS;

        //Set groundwater depth outside of zone of influence if not present
        if (!this.groundwaterDepth) this.groundwaterDepth = 2 * (this.depth + this.width);

        //Determine effective unit weight if groundwater is in influence zone
        if (this.groundwaterDepth <= this.depth) {
            this.effectiveUnitWeight = this.unitWeight - unitWeightWater;
        } else if (this.depth < this.groundwaterDepth && this.groundwaterDepth < (this.depth + this.width)) {
            this.effectiveUnitWeight = this.unitWeight - unitWeightWater * (1 - (this.groundwaterDepth - this.depth) / this.width);
        } else {
            this.effectiveUnitWeight = this.unitWeight;
        }

        //Calculate effective stress
        if (this.groundwaterDepth >= this.depth) this.effectiveStress = this.unitWeight * this.depth;
        else {
            let totalStress = unitWeight * depth;
            let porePressure = (depth - groundwaterDepth) * unitWeightWater;
            this.effectiveStress = totalStress - porePressure;
        }

        //Determine bearing capacity factors
        this.Nc = NTerzaghi[this.phi][0];
        this.Nq = NTerzaghi[this.phi][1];
        this.Ng = NTerzaghi[this.phi][2];

        //Determine term coefficients
        switch (this.shape) {
            case "square":
                this.coef1 = 1.3;
                this.coef2 = 1;
                this.coef3 = 0.4;
                this.equation = `(1.3 c * Nq) + (Eff.Stress * Nq) + (0.4 * gamma * B * Ng)`;
                break;
            case "continuous":
                this.coef1 = 1;
                this.coef2 = 1;
                this.coef3 = 0.5;
                this.equation = `(c * Nq) + (Eff.Stress * Nq) + (0.5 * gamma * B * Ng)`;
                break;
            case "circular":
                this.coef1 = 1.3;
                this.coef2 = 1;
                this.coef3 = 0.3;
                this.equation = `(1.3 c * Nq) + (Eff.Stress * Nq) + (0.3 * gamma * B * Ng)`;
                break;
            default:
                this.coef1 = 1;
                this.coef2 = 1;
                this.coef3 = 0.5;
                this.equation = `(c * Nq) + (Eff.Stress * Nq) + (0.5 * gamma * B * Ng)`;
                console.log('Error: bad shape choice. Defaulting to continuous');
                break;
        }

        //calculate bearing capacity
        this.bearingCapacity = Math.round((this.coef1 * this.cohesion * this.Nc)+ (this.coef2 * this.effectiveStress * this.Nq) + (this.coef3 * this.effectiveUnitWeight * this.width * this.Ng));
        //calculate allowable capacity
        this.allowableCapacity = Math.round(this.bearingCapacity / this.FS);
        this.calculation = `(${this.coef1} x ${this.cohesion} x ${this.Nc}) + (${this.coef2} x ${Math.round(this.effectiveStress)} x ${this.Nq}) + (${this.coef3} x ${Math.round(this.effectiveUnitWeight)} x ${this.width} x ${this.Ng}) = ${this.bearingCapacity}`;
    }
}

function getRadioValue() {
    /*
    reads radio button. Defaults to continuous
    */
    let element = document.getElementsByName('foundation-type');
    for(let i=0; i<element.length; i++) {
        if (element[i].checked) {
            return element[i].value;
        }
    }
    return 'continuous';
}

const startState = {
    shape: "continuous",
    cohesion: undefined,
    phi: undefined,
    unitWeight: undefined,
    depth: undefined,
    width: undefined,
    groundwaterDepth: undefined,
    fs: 3,
    renderedFS: 3,
    bearingCapacity: undefined,
    allowableCapacity: undefined,
    calculation: undefined,
    equation: undefined,
    calculated: false,
    error: {
        cohesion: false,
        phi: false,
        unitWeight: false,
        depth: false,
        width: false,
        groundwaterDepth: false,
        fs: false,
        undefinedInput: false,
        cannotEvaluate: false
    }
};

class BearingCapacityApp extends React.Component {
    constructor(props) {
        super(props);
        this.state = startState; //this is actually a assigning a reference to start state, but there is no native deep clone and this works for now
        console.log(this.state);
        this.isValidFloat = this.isValidFloat.bind(this);
        this.isValidInt = this.isValidInt.bind(this);
        this.handleCohesion = this.handleCohesion.bind(this);
        this.handlePhi = this.handlePhi.bind(this);
        this.handleUnitWeight = this.handleUnitWeight.bind(this);
        this.handleDepth = this.handleDepth.bind(this);
        this.handleWidth = this.handleWidth.bind(this);
        this.handleGroundwaterDepth = this.handleGroundwaterDepth.bind(this);
        this.handleFS = this.handleFS.bind(this);
        this.handleCalculateBearingCapacity = this.handleCalculateBearingCapacity.bind(this);
        this.allFieldsAreDefined = this.allFieldsAreDefined.bind(this);
        this.handleReset = this.handleReset.bind(this);
        this.handleEnterKey = this.handleEnterKey.bind(this);
    }

    isValidFloat(string, parameter) {
        /*
        Checks input string against valid form for parameter.
        String should be a non-negative number.
        Sets parameter error state accordingly.
        Returns true if valid, false otherwise.
        */
        let updatedError = this.state.error;
        if (string.search(/^[0-9]+[.]?[0-9]*$|^[.][0-9]+$/) > -1) {
            updatedError[parameter] = false;
            this.setState(state => ({
                ...state,
                error: updatedError
            }));
            return true;
        } else {
            updatedError[parameter] = true;
            this.setState(state => ({
                ...state,
                error: updatedError
            }));
            return false;
        }
    }

    isValidInt(string, parameter) {
        /*
        Checks input string against valid form for parameter.
        Thie only parameter that uses this is phi.
        String should be an integer, 0 to 41.
        Sets parameter error state accordingly.
        Returns true if valid, false otherwise.
        */
        let updatedError = this.state.error;
        if (string.search(/^[0-9]+$/) > -1 && string < 42) {
            updatedError[parameter] = false;
            this.setState(state => ({
                ...state,
                error: updatedError
            }));
            return true;
        } else {
            updatedError[parameter] = true;
            this.setState(state => ({
                ...state,
                error: updatedError
            }));
            return false;
        }
    }

    handleCohesion(event) {
        /*
        Continuously update cohesion in state.
        Note that an invalid value for cohesion can be saved into state,
        but the isValidFloat callback will cause an error message,
        and the this.state.error.cohesion = true will stop handleCalculateBearingCapacity
        from carrying out the calculation.
        */      
        this.setState(state => ({
            ...state,
            cohesion: event.target.value
        }), () => {
            this.isValidFloat(this.state.cohesion, 'cohesion');
        }); 
    }

    handlePhi(event) {
        /*
        Continuously update phi in state.
        Note that an invalid value for phi can be saved into state,
        but the isValidInt callback will cause an error message,
        and the this.state.error.phi = true will stop handleCalculateBearingCapacity
        from carrying out the calculation.
        */
       this.setState(state => ({
            ...state,
            phi: event.target.value
        }), () => {
            this.isValidInt(this.state.phi, 'phi');
        }); 
    }

    handleUnitWeight(event) {
        /*
        Continuously update unitWeight in state.
        Note that an invalid value for cohesion can be saved into state,
        but the isValidFloat callback will cause an error message,
        and the this.state.error.unitWeight = true will stop handleCalculateBearingCapacity
        from carrying out the calculation.
        */
        this.setState(state => ({
            ...state,
            unitWeight: event.target.value
        }), () => {
            this.isValidFloat(this.state.unitWeight, 'unitWeight');
        }); 
    }

    handleDepth(event) {
        /*
        Continuously update depth in state.
        Note that an invalid value for depth can be saved into state,
        but the isValidFloat callback will cause an error message,
        and the this.state.error.depth = true will stop handleCalculateBearingCapacity
        from carrying out the calculation.
        */
        this.setState(state => ({
            ...state,
            depth: event.target.value
        }), () => {
            this.isValidFloat(this.state.depth, 'depth');
        }); 
    }

    handleWidth(event) {
        /*
        Continuously update depth in state.
        Note that an invalid value for width can be saved into state,
        but the isValidFloat callback will cause an error message,
        and the this.state.error.width = true will stop handleCalculateBearingCapacity
        from carrying out the calculation.
        */
        this.setState(state => ({
            ...state,
            width: event.target.value
        }), () => {
            this.isValidFloat(this.state.width, 'width');
        }); 
    }

    handleGroundwaterDepth(event) {
        /*
        Continuously update groundwaterDepth in state.
        Note that an invalid value for groundwaterDepth can be saved into state,
        but the isValidFloat callback will cause an error message,
        and the this.state.error.groundwaterDepth = true will stop handleCalculateBearingCapacity
        from carrying out the calculation.
        */
        this.setState(state => ({
            ...state,
            groundwaterDepth: event.target.value
        }), () => {
            this.isValidFloat(this.state.groundwaterDepth, 'groundwaterDepth');
        }); 
    }

    handleFS(event) {
        /*
        Continuously update FS in state.
        Note that an invalid value for FS can be saved into state,
        but the isValidFloat callback will cause an error message,
        and the this.state.error.FS = true will stop handleCalculateBearingCapacity
        from carrying out the calculation.
        */
        this.setState(state => ({
            ...state,
            FS: event.target.value
        }), () => {
            this.isValidFloat(this.state.FS, 'FS');
        });
    }

    handleCalculateBearingCapacity() {
        /*
        If all user fields are defined and valid, Calculates bearingCapacity, allowableBearingCapacity, calculation, and equation.
        Sets this.state.calulated to true, triggering the rendering of the results.
        Otherwise sets this.state.error.cannotEvalue to true, triggering rendering of error message.
        */
       let shape = getRadioValue(); // pull shape from radio value, or set to continuous if none selected
       let updatedError = this.state.error; // This is needed to update error state later

       //If all fields are defined AND valid, evaluates inputs
       if (this.allFieldsAreDefined() &&
        this.isValidFloat(this.state.cohesion, 'cohesion') &&
        this.isValidInt(this.state.phi, 'phi') &&
        this.isValidFloat(this.state.unitWeight, 'unitWeight') &&
        this.isValidFloat(this.state.depth, 'depth') &&
        this.isValidFloat(this.state.width, 'width') &&
        this.isValidFloat(this.state.groundwaterDepth, 'groundwaterDepth') &&
        this.isValidFloat(this.state.FS, 'FS')) {
            updatedError.cannotEvaluate = false;
            let result = new TerzaghiBearingCapacity(this.state.cohesion, this.state.phi, this.state.depth, this.state.unitWeight, this.state.width, shape, this.state.groundwaterDepth, this.state.FS);
            //load calculated values into state
            this.setState(state => ({
                    ...state,
                    shape: shape,
                    renderedFS: state.FS, //this is needed so that the rendered FS doesn't change if user changes FS input field
                    bearingCapacity: result.bearingCapacity,
                    allowableCapacity: result.allowableCapacity,
                    calculation: result.calculation,
                    equation: result.equation,
                    calculated: true
                })); 
        } else {
            updatedError.cannotEvaluate = true;
            this.setState(state => ({
                ...state,
                error: updatedError,
                calculated: false
            }));
        }
    }

    allFieldsAreDefined() {
        /*
        Checks to make sure all user inputted fields have been defined.
        Skips shape because calculation defaults to continuous if radio buttons are unchecked.
        Sets this.state.error.undefinedInput to true if any fields are undefined, which triggers rendering of an error message.
        */
        let updatedError = this.state.error;
        if (!this.state.cohesion ||
            !this.state.phi ||
            !this.state.unitWeight ||
            !this.state.depth ||
            !this.state.width ||
            !this.state.groundwaterDepth ||
            !this.state.FS) {            
                updatedError.undefinedInput = true;
                this.setState(state => ({
                    ...state,
                    error: updatedError
                }));
                return false;
            } else {
                updatedError.undefinedInput = false;
                this.setState(state=> ({
                    ...state,
                    error: updatedError
                }));
                return true;
            }
    }

    handleReset() {
        /*
        Resets the app to initial conditions. 
        TODO: Figure out a way to deep clone the initialState to reset that way
        */
        Array.from(document.querySelectorAll("input")).forEach(input => (input.value = ""));
        this.setState(state => ({
            shape: "continuous",
            cohesion: undefined,
            phi: undefined,
            unitWeight: undefined,
            depth: undefined,
            width: undefined,
            groundwaterDepth: undefined,
            fs: 3,
            renderedFS: 3,
            bearingCapacity: undefined,
            allowableCapacity: undefined,
            calculation: undefined,
            equation: undefined,
            calculated: false,
            error: {
                cohesion: false,
                phi: false,
                unitWeight: false,
                depth: false,
                width: false,
                groundwaterDepth: false,
                fs: false,
                undefinedInput: false,
                cannotEvaluate: false
            }
        }));
    }

    handleEnterKey(event) {
        if (event.key === "Enter") this.handleCalculateBearingCapacity();
    }

    render() {
        return (
            <div>
                <h1>Terzaghi Bearing Capacity Calculator</h1>
                <p id="info">For more information on bearing capacity calculation, take a look at <a href="https://en.wikipedia.org/wiki/Bearing_capacity#Terzaghi's_Bearing_Capacity_Theory" target="_blank">the wikipedia page for Bearing Capacity</a>.</p>
                <form>
                {/*Radio buttons for foundation type selection */}
                <input type='radio' id='continuous-radio-button' name='foundation-type' value='continuous'></input>
                <label for='continuous'>continuous</label>
                <input type='radio' id='square-radio-button' name='foundation-type' value='square'></input>
                <label for='square'>square</label>
                <input type='radio' id='circular-radio-button' name='foundation-type' value='circular'></input>
                <label for='circular'>circular</label>


                {/* Input fields for cohesion, phi, unitWeight, depth, width, groundwaterDepth=undefined, FS
                    Each input field has a corresponding error message that displays when invalid input is entered */}
                <div class="row">
                    <div class="col-xs-4 input-label">
                        <span>cohesion (psf)</span>
                    </div>
                    <div class="col-xs-3 input-box">
                        <input id='cohesion' autoComplete="off" size={TEXT_BOX_SIZE} onChange={this.handleCohesion} onKeyPress={this.handleEnterKey}></input>
                    </div>
                    <div class="col-xs-5 error-message">
                        {this.state.error.cohesion && <span>invalid cohesion</span>}
                    </div>
                </div>

                <div class="row input">
                    <div class="col-xs-4 input-label">
                        <span>phi (degrees)</span>
                    </div>
                    <div class="col-xs-3 input-box">
                        <input id='phi' autoComplete="off" size={TEXT_BOX_SIZE} onChange={this.handlePhi} onKeyPress={this.handleEnterKey}></input>
                    </div>
                    <div class="col-xs-5 error-message">
                        {this.state.error.phi && <span class='error-message'>invalid phi</span>}
                    </div>
                </div>

                <div class="row input">
                    <div class="col-xs-4 input-label">
                        <span>unit weight (pcf)</span>
                    </div>
                    <div class="col-xs-3 input-box">
                        <input id='unit-weight' autoComplete="off" size={TEXT_BOX_SIZE} onChange={this.handleUnitWeight} onKeyPress={this.handleEnterKey}></input>
                    </div>
                    <div clas="col-xs-5 error-message">
                        {this.state.error.unitWeight && <span class='error-message'>invalid unit weight</span>}
                    </div>
                </div>

                <div class="row input">
                    <div class="col-xs-4 input-label">
                        <span>depth (ft)</span>
                    </div>
                    <div class="col-xs-3 input-box">
                        <input id='depth' autoComplete="off" size={TEXT_BOX_SIZE} onChange={this.handleDepth} onKeyPress={this.handleEnterKey}></input>
                    </div>
                    <div class="col-xs-5 error-message">
                        {this.state.error.depth && <span class='error-message'>invalid depth</span>}
                    </div>
                </div>

                <div class="row input">
                    <div class="col-xs-4 input-label">
                        <span>width (ft)</span>
                    </div>
                    <div class="col-xs-3 input-box">
                        <input id='width' autoComplete="off" size={TEXT_BOX_SIZE} onChange={this.handleWidth} onKeyPress={this.handleEnterKey}></input>
                    </div>
                    <div class="col-xs-5 error-message">
                        {this.state.error.width && <span class='error-message'>invalid width</span>}
                    </div>
                </div>

                <div class="row input">
                    <div class="col-xs-4 input-label">
                        <span>groundwater depth (ft)</span>
                    </div>
                    <div class="col-xs-3 input-box">
                        <input id='groundwater-depth' autoComplete="off" size={TEXT_BOX_SIZE} onChange={this.handleGroundwaterDepth} onKeyPress={this.handleEnterKey}></input>
                    </div>
                    <div class="col-xs-5 error-message">
                        {this.state.error.groundwaterDepth && <span class='error-message'>invalid groundwater depth</span>}
                    </div>
                </div>

                <div class="row input">
                    <div class="col-xs-4 input-label">
                        <span>factor of safety</span>
                    </div>
                    <div class="col-xs-3 input-box">
                        <input id='fs' autoComplete="off" size={TEXT_BOX_SIZE} onChange={this.handleFS} onKeyPress={this.handleEnterKey}></input>
                    </div>
                    <div class="col-xs-5 error-message">
                        {this.state.error.FS && <span class='error-message'>invalid FS</span>}
                    </div>
                </div>

                {/* Button to generate answer, equation, and calculation */}
                </form>
                <button class='btn btn-primary' id='calculate-bearing-capacity' onClick={this.handleCalculateBearingCapacity}>Calculate bearing capacity</button>
                <button class='btn btn-danger' id='reset' onClick={this.handleReset}>Reset</button>

                {/* Results to render after clicking 'Calculate bearing capacity */}
                {this.state.calculated && 
                    <div id='results'>
                        <p class="results">{this.state.equation}</p>
                        <p class="results">{this.state.calculation}</p>
                        <p class="results">Ultimate bearing capacity: {this.state.bearingCapacity} psf</p>
                        <p class="results">Allowable bearing capacity with a factor of safety of {this.state.renderedFS}: <span id='allowable-capacity'>{this.state.allowableCapacity} psf</span></p>
                    </div>
                }
                {this.state.error.cannotEvaluate && <p class='error-message'>Cannot evaluate. Make sure all inputs are valid.</p>}
            </div>
        );
    }
}

ReactDOM.render(<BearingCapacityApp/>, document.getElementById('bearing-capacity-app'));

