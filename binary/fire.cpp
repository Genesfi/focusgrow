/* ------------------------------------------------------------
name: "untitled"
Code generated with Faust 2.81.10 (https://faust.grame.fr)
Compilation options: -lang cpp -ct 1 -es 1 -mcd 16 -mdd 1024 -mdy 33 -single -ftz 0
------------------------------------------------------------ */

#ifndef  __mydsp_H__
#define  __mydsp_H__

#ifndef FAUSTFLOAT
#define FAUSTFLOAT float
#endif 

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <math.h>

#ifndef FAUSTCLASS 
#define FAUSTCLASS mydsp
#endif

#ifdef __APPLE__ 
#define exp10f __exp10f
#define exp10 __exp10
#endif

#if defined(_WIN32)
#define RESTRICT __restrict
#else
#define RESTRICT __restrict__
#endif

class mydspSIG0 {
	
  private:
	
	int iVec1[2];
	int iRec4[2];
	
  public:
	
	int getNumInputsmydspSIG0() {
		return 0;
	}
	int getNumOutputsmydspSIG0() {
		return 1;
	}
	
	void instanceInitmydspSIG0(int sample_rate) {
		for (int l1 = 0; l1 < 2; l1 = l1 + 1) {
			iVec1[l1] = 0;
		}
		for (int l2 = 0; l2 < 2; l2 = l2 + 1) {
			iRec4[l2] = 0;
		}
	}
	
	void fillmydspSIG0(int count, float* table) {
		for (int i1 = 0; i1 < count; i1 = i1 + 1) {
			iVec1[0] = 1;
			iRec4[0] = (iVec1[1] + iRec4[1]) % 65536;
			table[i1] = std::sin(9.58738e-05f * static_cast<float>(iRec4[0]));
			iVec1[1] = iVec1[0];
			iRec4[1] = iRec4[0];
		}
	}

};

static mydspSIG0* newmydspSIG0() { return (mydspSIG0*)new mydspSIG0(); }
static void deletemydspSIG0(mydspSIG0* dsp) { delete dsp; }

static float mydsp_faustpower2_f(float value) {
	return value * value;
}
static float ftbl0mydspSIG0[65536];

class mydsp : public dsp {
	
 private:
	
	int iVec0[2];
	int fSampleRate;
	float fConst0;
	float fConst1;
	float fConst2;
	float fConst3;
	float fConst4;
	float fConst5;
	float fConst6;
	float fConst7;
	float fConst8;
	float fConst9;
	float fConst10;
	float fConst11;
	float fConst12;
	float fConst13;
	float fConst14;
	float fConst15;
	float fConst16;
	float fConst17;
	float fRec5[2];
	float fConst18;
	int iRec8[2];
	float fVec2[2];
	float fConst19;
	float fRec7[2];
	float fRec6[3];
	float fConst20;
	float fRec12[2];
	float fVec3[2];
	float fRec11[2];
	float fVec4[2];
	float fRec13[2];
	float fConst21;
	float fRec10[2];
	float fRec14[2];
	float fConst22;
	float fRec9[2];
	float fVec5[2];
	float fConst23;
	float fConst24;
	float fRec3[2];
	float fRec2[3];
	float fConst25;
	float fConst26;
	float fConst27;
	float fConst28;
	float fConst29;
	float fConst30;
	float fConst31;
	float fConst32;
	float fRec16[2];
	float fRec15[3];
	float fConst33;
	float fConst34;
	float fConst35;
	float fConst36;
	float fConst37;
	float fConst38;
	float fConst39;
	float fConst40;
	float fConst41;
	float fConst42;
	float fRec18[2];
	float fRec17[3];
	float fConst43;
	float fConst44;
	float fConst45;
	float fRec25[2];
	float fRec26[2];
	float fRec24[2];
	float fRec23[2];
	float fRec22[2];
	float fRec21[2];
	float fRec20[2];
	float fRec19[2];
	float fConst46;
	float fVec6[2];
	float fRec1[2];
	float fRec0[3];
	float fConst47;
	float fConst48;
	float fRec29[2];
	float fConst49;
	float fRec33[2];
	float fVec7[2];
	float fRec32[2];
	float fVec8[2];
	float fRec34[2];
	float fRec31[2];
	float fRec35[2];
	float fRec30[2];
	float fVec9[2];
	float fRec28[2];
	float fRec27[3];
	float fConst50;
	float fRec38[2];
	float fConst51;
	float fRec42[2];
	float fVec10[2];
	float fRec41[2];
	float fVec11[2];
	float fRec43[2];
	float fRec40[2];
	float fRec44[2];
	float fRec39[2];
	float fVec12[2];
	float fRec37[2];
	float fRec36[3];
	FAUSTFLOAT fCheckbox0;
	float fRec46[2];
	float fRec45[3];
	
 public:
	mydsp() {
	}
	
	void metadata(Meta* m) { 
		m->declare("basics.lib/name", "Faust Basic Element Library");
		m->declare("basics.lib/version", "1.22.0");
		m->declare("compile_options", "-lang cpp -ct 1 -es 1 -mcd 16 -mdd 1024 -mdy 33 -single -ftz 0");
		m->declare("envelopes.lib/arfe:author", "Julius O. Smith III, revised by Stephane Letz");
		m->declare("envelopes.lib/arfe:licence", "STK-4.3");
		m->declare("envelopes.lib/author", "GRAME");
		m->declare("envelopes.lib/copyright", "GRAME");
		m->declare("envelopes.lib/license", "LGPL with exception");
		m->declare("envelopes.lib/name", "Faust Envelope Library");
		m->declare("envelopes.lib/version", "1.3.0");
		m->declare("filename", "untitled.dsp");
		m->declare("filters.lib/fir:author", "Julius O. Smith III");
		m->declare("filters.lib/fir:copyright", "Copyright (C) 2003-2019 by Julius O. Smith III <jos@ccrma.stanford.edu>");
		m->declare("filters.lib/fir:license", "MIT-style STK-4.3 license");
		m->declare("filters.lib/highpass:author", "Julius O. Smith III");
		m->declare("filters.lib/highpass:copyright", "Copyright (C) 2003-2019 by Julius O. Smith III <jos@ccrma.stanford.edu>");
		m->declare("filters.lib/iir:author", "Julius O. Smith III");
		m->declare("filters.lib/iir:copyright", "Copyright (C) 2003-2019 by Julius O. Smith III <jos@ccrma.stanford.edu>");
		m->declare("filters.lib/iir:license", "MIT-style STK-4.3 license");
		m->declare("filters.lib/lowpass0_highpass1", "Copyright (C) 2003-2019 by Julius O. Smith III <jos@ccrma.stanford.edu>");
		m->declare("filters.lib/lowpass0_highpass1:author", "Julius O. Smith III");
		m->declare("filters.lib/lowpass:author", "Julius O. Smith III");
		m->declare("filters.lib/lowpass:copyright", "Copyright (C) 2003-2019 by Julius O. Smith III <jos@ccrma.stanford.edu>");
		m->declare("filters.lib/lowpass:license", "MIT-style STK-4.3 license");
		m->declare("filters.lib/name", "Faust Filters Library");
		m->declare("filters.lib/nlf2:author", "Julius O. Smith III");
		m->declare("filters.lib/nlf2:copyright", "Copyright (C) 2003-2019 by Julius O. Smith III <jos@ccrma.stanford.edu>");
		m->declare("filters.lib/nlf2:license", "MIT-style STK-4.3 license");
		m->declare("filters.lib/tf1:author", "Julius O. Smith III");
		m->declare("filters.lib/tf1:copyright", "Copyright (C) 2003-2019 by Julius O. Smith III <jos@ccrma.stanford.edu>");
		m->declare("filters.lib/tf1:license", "MIT-style STK-4.3 license");
		m->declare("filters.lib/tf1s:author", "Julius O. Smith III");
		m->declare("filters.lib/tf1s:copyright", "Copyright (C) 2003-2019 by Julius O. Smith III <jos@ccrma.stanford.edu>");
		m->declare("filters.lib/tf1s:license", "MIT-style STK-4.3 license");
		m->declare("filters.lib/tf2:author", "Julius O. Smith III");
		m->declare("filters.lib/tf2:copyright", "Copyright (C) 2003-2019 by Julius O. Smith III <jos@ccrma.stanford.edu>");
		m->declare("filters.lib/tf2:license", "MIT-style STK-4.3 license");
		m->declare("filters.lib/tf2s:author", "Julius O. Smith III");
		m->declare("filters.lib/tf2s:copyright", "Copyright (C) 2003-2019 by Julius O. Smith III <jos@ccrma.stanford.edu>");
		m->declare("filters.lib/tf2s:license", "MIT-style STK-4.3 license");
		m->declare("filters.lib/version", "1.7.1");
		m->declare("maths.lib/author", "GRAME");
		m->declare("maths.lib/copyright", "GRAME");
		m->declare("maths.lib/license", "LGPL with exception");
		m->declare("maths.lib/name", "Faust Math Library");
		m->declare("maths.lib/version", "2.9.0");
		m->declare("name", "untitled");
		m->declare("noises.lib/name", "Faust Noise Generator Library");
		m->declare("noises.lib/version", "1.5.0");
		m->declare("oscillators.lib/lf_sawpos:author", "Bart Brouns, revised by Stéphane Letz");
		m->declare("oscillators.lib/lf_sawpos:licence", "STK-4.3");
		m->declare("oscillators.lib/name", "Faust Oscillator Library");
		m->declare("oscillators.lib/version", "1.6.0");
		m->declare("platform.lib/name", "Generic Platform Library");
		m->declare("platform.lib/version", "1.3.0");
		m->declare("signals.lib/name", "Faust Signal Routing Library");
		m->declare("signals.lib/version", "1.6.0");
	}

	virtual int getNumInputs() {
		return 0;
	}
	virtual int getNumOutputs() {
		return 1;
	}
	
	static void classInit(int sample_rate) {
		mydspSIG0* sig0 = newmydspSIG0();
		sig0->instanceInitmydspSIG0(sample_rate);
		sig0->fillmydspSIG0(65536, ftbl0mydspSIG0);
		deletemydspSIG0(sig0);
	}
	
	virtual void instanceConstants(int sample_rate) {
		fSampleRate = sample_rate;
		fConst0 = std::min<float>(1.92e+05f, std::max<float>(1.0f, static_cast<float>(fSampleRate)));
		fConst1 = std::tan(31415.926f / fConst0);
		fConst2 = mydsp_faustpower2_f(fConst1);
		fConst3 = 2.0f * (1.0f - 1.0f / fConst2);
		fConst4 = 1.0f / fConst1;
		fConst5 = (fConst4 + -1.0f) / fConst1 + 1.0f;
		fConst6 = (fConst4 + 1.0f) / fConst1 + 1.0f;
		fConst7 = 1.0f / fConst6;
		fConst8 = std::tan(3141.5928f / fConst0);
		fConst9 = mydsp_faustpower2_f(fConst8);
		fConst10 = 1.0f / fConst9;
		fConst11 = 2.0f * (1.0f - fConst10);
		fConst12 = 1.0f / fConst8;
		fConst13 = (fConst12 + -1.0f) / fConst8 + 1.0f;
		fConst14 = (fConst12 + 1.0f) / fConst8 + 1.0f;
		fConst15 = 1.0f / fConst14;
		fConst16 = 1.0f - fConst12;
		fConst17 = 1e+01f / fConst0;
		fConst18 = 1.0f - fConst4;
		fConst19 = 1.0f / (fConst4 + 1.0f);
		fConst20 = 5.0f / fConst0;
		fConst21 = 0.001f * fConst0;
		fConst22 = 1.0f / fConst0;
		fConst23 = 0.77f / (fConst8 * fConst6);
		fConst24 = 1.0f / (fConst12 + 1.0f);
		fConst25 = 1.0f / (fConst9 * fConst14);
		fConst26 = std::tan(1570.7964f / fConst0);
		fConst27 = 2.0f * (1.0f - 1.0f / mydsp_faustpower2_f(fConst26));
		fConst28 = 1.0f / fConst26;
		fConst29 = (fConst28 + -1.0f) / fConst26 + 1.0f;
		fConst30 = 1.0f / ((fConst28 + 1.0f) / fConst26 + 1.0f);
		fConst31 = 1.0f - fConst28;
		fConst32 = 1.0f / (fConst28 + 1.0f);
		fConst33 = std::tan(9424.778f / fConst0);
		fConst34 = mydsp_faustpower2_f(fConst33);
		fConst35 = 2.0f * (1.0f - 1.0f / fConst34);
		fConst36 = 1.0f / fConst33;
		fConst37 = (fConst36 + -1.0f) / fConst33 + 1.0f;
		fConst38 = (fConst36 + 1.0f) / fConst33 + 1.0f;
		fConst39 = 1.0f / fConst38;
		fConst40 = 1.0f - fConst36;
		fConst41 = 4.656613e-10f / fConst33;
		fConst42 = 1.0f / (fConst36 + 1.0f);
		fConst43 = 6283.1855f / fConst0;
		fConst44 = std::cos(fConst43);
		fConst45 = std::sin(fConst43);
		fConst46 = 0.1f / (fConst34 * fConst38);
		fConst47 = 1.0f / (fConst2 * fConst6);
		fConst48 = 2.5e+02f / fConst0;
		fConst49 = 0.2f / fConst0;
		fConst50 = 5e+02f / fConst0;
		fConst51 = 0.1f / fConst0;
	}
	
	virtual void instanceResetUserInterface() {
		fCheckbox0 = static_cast<FAUSTFLOAT>(0.0f);
	}
	
	virtual void instanceClear() {
		for (int l0 = 0; l0 < 2; l0 = l0 + 1) {
			iVec0[l0] = 0;
		}
		for (int l3 = 0; l3 < 2; l3 = l3 + 1) {
			fRec5[l3] = 0.0f;
		}
		for (int l4 = 0; l4 < 2; l4 = l4 + 1) {
			iRec8[l4] = 0;
		}
		for (int l5 = 0; l5 < 2; l5 = l5 + 1) {
			fVec2[l5] = 0.0f;
		}
		for (int l6 = 0; l6 < 2; l6 = l6 + 1) {
			fRec7[l6] = 0.0f;
		}
		for (int l7 = 0; l7 < 3; l7 = l7 + 1) {
			fRec6[l7] = 0.0f;
		}
		for (int l8 = 0; l8 < 2; l8 = l8 + 1) {
			fRec12[l8] = 0.0f;
		}
		for (int l9 = 0; l9 < 2; l9 = l9 + 1) {
			fVec3[l9] = 0.0f;
		}
		for (int l10 = 0; l10 < 2; l10 = l10 + 1) {
			fRec11[l10] = 0.0f;
		}
		for (int l11 = 0; l11 < 2; l11 = l11 + 1) {
			fVec4[l11] = 0.0f;
		}
		for (int l12 = 0; l12 < 2; l12 = l12 + 1) {
			fRec13[l12] = 0.0f;
		}
		for (int l13 = 0; l13 < 2; l13 = l13 + 1) {
			fRec10[l13] = 0.0f;
		}
		for (int l14 = 0; l14 < 2; l14 = l14 + 1) {
			fRec14[l14] = 0.0f;
		}
		for (int l15 = 0; l15 < 2; l15 = l15 + 1) {
			fRec9[l15] = 0.0f;
		}
		for (int l16 = 0; l16 < 2; l16 = l16 + 1) {
			fVec5[l16] = 0.0f;
		}
		for (int l17 = 0; l17 < 2; l17 = l17 + 1) {
			fRec3[l17] = 0.0f;
		}
		for (int l18 = 0; l18 < 3; l18 = l18 + 1) {
			fRec2[l18] = 0.0f;
		}
		for (int l19 = 0; l19 < 2; l19 = l19 + 1) {
			fRec16[l19] = 0.0f;
		}
		for (int l20 = 0; l20 < 3; l20 = l20 + 1) {
			fRec15[l20] = 0.0f;
		}
		for (int l21 = 0; l21 < 2; l21 = l21 + 1) {
			fRec18[l21] = 0.0f;
		}
		for (int l22 = 0; l22 < 3; l22 = l22 + 1) {
			fRec17[l22] = 0.0f;
		}
		for (int l23 = 0; l23 < 2; l23 = l23 + 1) {
			fRec25[l23] = 0.0f;
		}
		for (int l24 = 0; l24 < 2; l24 = l24 + 1) {
			fRec26[l24] = 0.0f;
		}
		for (int l25 = 0; l25 < 2; l25 = l25 + 1) {
			fRec24[l25] = 0.0f;
		}
		for (int l26 = 0; l26 < 2; l26 = l26 + 1) {
			fRec23[l26] = 0.0f;
		}
		for (int l27 = 0; l27 < 2; l27 = l27 + 1) {
			fRec22[l27] = 0.0f;
		}
		for (int l28 = 0; l28 < 2; l28 = l28 + 1) {
			fRec21[l28] = 0.0f;
		}
		for (int l29 = 0; l29 < 2; l29 = l29 + 1) {
			fRec20[l29] = 0.0f;
		}
		for (int l30 = 0; l30 < 2; l30 = l30 + 1) {
			fRec19[l30] = 0.0f;
		}
		for (int l31 = 0; l31 < 2; l31 = l31 + 1) {
			fVec6[l31] = 0.0f;
		}
		for (int l32 = 0; l32 < 2; l32 = l32 + 1) {
			fRec1[l32] = 0.0f;
		}
		for (int l33 = 0; l33 < 3; l33 = l33 + 1) {
			fRec0[l33] = 0.0f;
		}
		for (int l34 = 0; l34 < 2; l34 = l34 + 1) {
			fRec29[l34] = 0.0f;
		}
		for (int l35 = 0; l35 < 2; l35 = l35 + 1) {
			fRec33[l35] = 0.0f;
		}
		for (int l36 = 0; l36 < 2; l36 = l36 + 1) {
			fVec7[l36] = 0.0f;
		}
		for (int l37 = 0; l37 < 2; l37 = l37 + 1) {
			fRec32[l37] = 0.0f;
		}
		for (int l38 = 0; l38 < 2; l38 = l38 + 1) {
			fVec8[l38] = 0.0f;
		}
		for (int l39 = 0; l39 < 2; l39 = l39 + 1) {
			fRec34[l39] = 0.0f;
		}
		for (int l40 = 0; l40 < 2; l40 = l40 + 1) {
			fRec31[l40] = 0.0f;
		}
		for (int l41 = 0; l41 < 2; l41 = l41 + 1) {
			fRec35[l41] = 0.0f;
		}
		for (int l42 = 0; l42 < 2; l42 = l42 + 1) {
			fRec30[l42] = 0.0f;
		}
		for (int l43 = 0; l43 < 2; l43 = l43 + 1) {
			fVec9[l43] = 0.0f;
		}
		for (int l44 = 0; l44 < 2; l44 = l44 + 1) {
			fRec28[l44] = 0.0f;
		}
		for (int l45 = 0; l45 < 3; l45 = l45 + 1) {
			fRec27[l45] = 0.0f;
		}
		for (int l46 = 0; l46 < 2; l46 = l46 + 1) {
			fRec38[l46] = 0.0f;
		}
		for (int l47 = 0; l47 < 2; l47 = l47 + 1) {
			fRec42[l47] = 0.0f;
		}
		for (int l48 = 0; l48 < 2; l48 = l48 + 1) {
			fVec10[l48] = 0.0f;
		}
		for (int l49 = 0; l49 < 2; l49 = l49 + 1) {
			fRec41[l49] = 0.0f;
		}
		for (int l50 = 0; l50 < 2; l50 = l50 + 1) {
			fVec11[l50] = 0.0f;
		}
		for (int l51 = 0; l51 < 2; l51 = l51 + 1) {
			fRec43[l51] = 0.0f;
		}
		for (int l52 = 0; l52 < 2; l52 = l52 + 1) {
			fRec40[l52] = 0.0f;
		}
		for (int l53 = 0; l53 < 2; l53 = l53 + 1) {
			fRec44[l53] = 0.0f;
		}
		for (int l54 = 0; l54 < 2; l54 = l54 + 1) {
			fRec39[l54] = 0.0f;
		}
		for (int l55 = 0; l55 < 2; l55 = l55 + 1) {
			fVec12[l55] = 0.0f;
		}
		for (int l56 = 0; l56 < 2; l56 = l56 + 1) {
			fRec37[l56] = 0.0f;
		}
		for (int l57 = 0; l57 < 3; l57 = l57 + 1) {
			fRec36[l57] = 0.0f;
		}
		for (int l58 = 0; l58 < 2; l58 = l58 + 1) {
			fRec46[l58] = 0.0f;
		}
		for (int l59 = 0; l59 < 3; l59 = l59 + 1) {
			fRec45[l59] = 0.0f;
		}
	}
	
	virtual void init(int sample_rate) {
		classInit(sample_rate);
		instanceInit(sample_rate);
	}
	
	virtual void instanceInit(int sample_rate) {
		instanceConstants(sample_rate);
		instanceResetUserInterface();
		instanceClear();
	}
	
	virtual mydsp* clone() {
		return new mydsp();
	}
	
	virtual int getSampleRate() {
		return fSampleRate;
	}
	
	virtual void buildUserInterface(UI* ui_interface) {
		ui_interface->openVerticalBox("untitled");
		ui_interface->addCheckButton("wet", &fCheckbox0);
		ui_interface->closeBox();
	}
	
	virtual void compute(int count, FAUSTFLOAT** RESTRICT inputs, FAUSTFLOAT** RESTRICT outputs) {
		FAUSTFLOAT* output0 = outputs[0];
		float fSlow0 = fConst10 * static_cast<float>(fCheckbox0);
		for (int i0 = 0; i0 < count; i0 = i0 + 1) {
			iVec0[0] = 1;
			int iTemp0 = 1 - iVec0[1];
			float fTemp1 = ((iTemp0) ? 0.0f : fConst17 + fRec5[1]);
			fRec5[0] = fTemp1 - std::floor(fTemp1);
			iRec8[0] = 1103515245 * iRec8[1] + 12345;
			float fTemp2 = static_cast<float>(iRec8[0]);
			fVec2[0] = fTemp2;
			float fTemp3 = 4.656613e-10f * (fTemp2 + fVec2[1]);
			fRec7[0] = fConst19 * (fTemp3 - fConst18 * fRec7[1]);
			fRec6[0] = fRec7[0] - fConst7 * (fConst5 * fRec6[2] + fConst3 * fRec6[1]);
			float fTemp4 = fRec6[2] + fRec6[0] + 2.0f * fRec6[1];
			float fTemp5 = ((iTemp0) ? 0.0f : fConst20 + fRec12[1]);
			fRec12[0] = fTemp5 - std::floor(fTemp5);
			float fTemp6 = fRec12[0] - fRec12[1];
			fVec3[0] = fTemp6;
			int iTemp7 = (fVec3[1] <= 0.0f) & (fTemp6 > 0.0f);
			fRec11[0] = fRec11[1] * static_cast<float>(1 - iTemp7) + 4.656613e-10f * fTemp2 * static_cast<float>(iTemp7);
			float fTemp8 = 0.5f * (fRec11[0] + 1.0f);
			float fTemp9 = std::fabs(4.656613e-10f * fVec2[1] * static_cast<float>((fRec12[0] >= fTemp8) * (fRec12[1] < fTemp8)));
			fVec4[0] = fTemp9;
			int iTemp10 = fTemp9 > 0.0f;
			int iTemp11 = (fVec4[1] <= 0.0f) & iTemp10;
			float fTemp12 = static_cast<float>(iTemp11);
			float fTemp13 = static_cast<float>(1 - iTemp11);
			fRec13[0] = fRec13[1] * fTemp13 + fTemp9 * fTemp12;
			fRec10[0] = ((iTemp10 > 0) ? fConst21 * (8.0f * fRec13[0] + 2.0f) : std::max<float>(0.0f, fRec10[1] + -1.0f));
			int iTemp14 = (fRec10[0] > 0.0f) > 0;
			float fTemp15 = std::fabs(4.656613e-10f * fTemp2);
			fRec14[0] = fTemp13 * fRec14[1] + fTemp15 * fTemp12;
			float fTemp16 = 0.1447178f * ((iTemp14) ? 0.001f : 0.3f * fRec14[0] + 0.1f);
			int iTemp17 = std::fabs(fTemp16) < 1.1920929e-07f;
			float fTemp18 = ((iTemp17) ? 0.0f : std::exp(-(fConst22 / ((iTemp17) ? 1.0f : fTemp16))));
			fRec9[0] = (1.0f - fTemp18) * ((iTemp14) ? static_cast<float>(iTemp14) : 0.0f) + fTemp18 * fRec9[1];
			float fTemp19 = fRec9[0] * fTemp4 * ftbl0mydspSIG0[std::max<int>(0, std::min<int>(static_cast<int>(65536.0f * fRec5[0]), 65535))];
			fVec5[0] = fTemp19;
			fRec3[0] = fConst24 * (fConst23 * (fTemp19 - fVec5[1]) - fConst16 * fRec3[1]);
			fRec2[0] = fRec3[0] - fConst15 * (fConst13 * fRec2[2] + fConst11 * fRec2[1]);
			fRec16[0] = fConst32 * (fTemp3 - fConst31 * fRec16[1]);
			fRec15[0] = fRec16[0] - fConst30 * (fConst29 * fRec15[2] + fConst27 * fRec15[1]);
			fRec18[0] = fConst42 * (fConst41 * (fTemp2 - fVec2[1]) - fConst40 * fRec18[1]);
			fRec17[0] = fRec18[0] - fConst39 * (fConst37 * fRec17[2] + fConst35 * fRec17[1]);
			fRec25[0] = fConst45 * fRec26[1] + fConst44 * fRec25[1];
			fRec26[0] = static_cast<float>(iTemp0) + fConst44 * fRec26[1] - fConst45 * fRec25[1];
			int iTemp20 = (fRec25[1] <= 0.0f) & (fRec25[0] > 0.0f);
			fRec24[0] = fRec24[1] * static_cast<float>(1 - iTemp20) + 4.656613e-10f * fTemp2 * static_cast<float>(iTemp20);
			fRec23[0] = -(fConst24 * (fConst16 * fRec23[1] - (fRec24[0] + fRec24[1])));
			fRec22[0] = -(fConst24 * (fConst16 * fRec22[1] - (fRec23[0] + fRec23[1])));
			fRec21[0] = -(fConst24 * (fConst16 * fRec21[1] - (fRec22[0] + fRec22[1])));
			fRec20[0] = -(fConst24 * (fConst16 * fRec20[1] - (fRec21[0] + fRec21[1])));
			fRec19[0] = -(fConst24 * (fConst16 * fRec19[1] - (fRec20[0] + fRec20[1])));
			float fTemp21 = fConst46 * mydsp_faustpower2_f(fRec19[0]) * (fRec17[2] + (fRec17[0] - 2.0f * fRec17[1])) + 0.2f * (fConst30 * (fRec15[2] + fRec15[0] + 2.0f * fRec15[1]) + fConst25 * (fRec2[2] + (fRec2[0] - 2.0f * fRec2[1])));
			fVec6[0] = fTemp21;
			fRec1[0] = -(fConst19 * (fConst18 * fRec1[1] - fConst4 * (fTemp21 - fVec6[1])));
			fRec0[0] = fRec1[0] - fConst7 * (fConst5 * fRec0[2] + fConst3 * fRec0[1]);
			float fTemp22 = ((iTemp0) ? 0.0f : fConst48 + fRec29[1]);
			fRec29[0] = fTemp22 - std::floor(fTemp22);
			float fTemp23 = ((iTemp0) ? 0.0f : fConst49 + fRec33[1]);
			fRec33[0] = fTemp23 - std::floor(fTemp23);
			float fTemp24 = fRec33[0] - fRec33[1];
			fVec7[0] = fTemp24;
			int iTemp25 = (fVec7[1] <= 0.0f) & (fTemp24 > 0.0f);
			fRec32[0] = fRec32[1] * static_cast<float>(1 - iTemp25) + 4.656613e-10f * fTemp2 * static_cast<float>(iTemp25);
			float fTemp26 = 0.5f * (fRec32[0] + 1.0f);
			float fTemp27 = std::fabs(4.656613e-10f * fVec2[1] * static_cast<float>((fRec33[0] >= fTemp26) * (fRec33[1] < fTemp26)));
			fVec8[0] = fTemp27;
			int iTemp28 = fTemp27 > 0.0f;
			int iTemp29 = (fVec8[1] <= 0.0f) & iTemp28;
			float fTemp30 = static_cast<float>(iTemp29);
			float fTemp31 = static_cast<float>(1 - iTemp29);
			fRec34[0] = fRec34[1] * fTemp31 + fTemp27 * fTemp30;
			fRec31[0] = ((iTemp28 > 0) ? fConst21 * (8.0f * fRec34[0] + 2.0f) : std::max<float>(0.0f, fRec31[1] + -1.0f));
			int iTemp32 = (fRec31[0] > 0.0f) > 0;
			fRec35[0] = fTemp31 * fRec35[1] + fTemp15 * fTemp30;
			float fTemp33 = 0.1447178f * ((iTemp32) ? 0.001f : 0.3f * (fRec35[0] + 1.0f));
			int iTemp34 = std::fabs(fTemp33) < 1.1920929e-07f;
			float fTemp35 = ((iTemp34) ? 0.0f : std::exp(-(fConst22 / ((iTemp34) ? 1.0f : fTemp33))));
			fRec30[0] = (1.0f - fTemp35) * ((iTemp32) ? static_cast<float>(iTemp32) : 0.0f) + fTemp35 * fRec30[1];
			float fTemp36 = fRec30[0] * fTemp4 * ftbl0mydspSIG0[std::max<int>(0, std::min<int>(static_cast<int>(65536.0f * fRec29[0]), 65535))];
			fVec9[0] = fTemp36;
			fRec28[0] = fConst24 * (fConst23 * (fTemp36 - fVec9[1]) - fConst16 * fRec28[1]);
			fRec27[0] = fRec28[0] - fConst15 * (fConst13 * fRec27[2] + fConst11 * fRec27[1]);
			float fTemp37 = ((iTemp0) ? 0.0f : fConst50 + fRec38[1]);
			fRec38[0] = fTemp37 - std::floor(fTemp37);
			float fTemp38 = ((iTemp0) ? 0.0f : fConst51 + fRec42[1]);
			fRec42[0] = fTemp38 - std::floor(fTemp38);
			float fTemp39 = fRec42[0] - fRec42[1];
			fVec10[0] = fTemp39;
			int iTemp40 = (fVec10[1] <= 0.0f) & (fTemp39 > 0.0f);
			fRec41[0] = fRec41[1] * static_cast<float>(1 - iTemp40) + 4.656613e-10f * fTemp2 * static_cast<float>(iTemp40);
			float fTemp41 = 0.5f * (fRec41[0] + 1.0f);
			float fTemp42 = std::fabs(4.656613e-10f * fVec2[1] * static_cast<float>((fRec42[0] >= fTemp41) * (fRec42[1] < fTemp41)));
			fVec11[0] = fTemp42;
			int iTemp43 = fTemp42 > 0.0f;
			int iTemp44 = (fVec11[1] <= 0.0f) & iTemp43;
			float fTemp45 = static_cast<float>(iTemp44);
			float fTemp46 = static_cast<float>(1 - iTemp44);
			fRec43[0] = fRec43[1] * fTemp46 + fTemp42 * fTemp45;
			fRec40[0] = ((iTemp43 > 0) ? fConst21 * (8.0f * fRec43[0] + 2.0f) : std::max<float>(0.0f, fRec40[1] + -1.0f));
			int iTemp47 = (fRec40[0] > 0.0f) > 0;
			fRec44[0] = fTemp46 * fRec44[1] + fTemp45 * fTemp15;
			float fTemp48 = 0.1447178f * ((iTemp47) ? 0.001f : 0.3f * fRec44[0] + 0.05f);
			int iTemp49 = std::fabs(fTemp48) < 1.1920929e-07f;
			float fTemp50 = ((iTemp49) ? 0.0f : std::exp(-(fConst22 / ((iTemp49) ? 1.0f : fTemp48))));
			fRec39[0] = (1.0f - fTemp50) * ((iTemp47) ? static_cast<float>(iTemp47) : 0.0f) + fTemp50 * fRec39[1];
			float fTemp51 = fRec39[0] * fTemp4 * ftbl0mydspSIG0[std::max<int>(0, std::min<int>(static_cast<int>(65536.0f * fRec38[0]), 65535))];
			fVec12[0] = fTemp51;
			fRec37[0] = fConst24 * (fConst23 * (fTemp51 - fVec12[1]) - fConst16 * fRec37[1]);
			fRec36[0] = fRec37[0] - fConst15 * (fConst13 * fRec36[2] + fConst11 * fRec36[1]);
			fRec46[0] = -(fConst24 * (fConst16 * fRec46[1] - (fTemp21 + fVec6[1])));
			fRec45[0] = fRec46[0] - fConst15 * (fConst13 * fRec45[2] + fConst11 * fRec45[1]);
			output0[i0] = static_cast<FAUSTFLOAT>(fConst15 * (fRec45[2] + fRec45[0] + 2.0f * fRec45[1] + fSlow0 * (3.0f * (fRec36[2] + (fRec36[0] - 2.0f * fRec36[1])) + 2.0f * (fRec27[2] + (fRec27[0] - 2.0f * fRec27[1])))) + fTemp21 + fConst47 * (fRec0[2] + (fRec0[0] - 2.0f * fRec0[1])));
			iVec0[1] = iVec0[0];
			fRec5[1] = fRec5[0];
			iRec8[1] = iRec8[0];
			fVec2[1] = fVec2[0];
			fRec7[1] = fRec7[0];
			fRec6[2] = fRec6[1];
			fRec6[1] = fRec6[0];
			fRec12[1] = fRec12[0];
			fVec3[1] = fVec3[0];
			fRec11[1] = fRec11[0];
			fVec4[1] = fVec4[0];
			fRec13[1] = fRec13[0];
			fRec10[1] = fRec10[0];
			fRec14[1] = fRec14[0];
			fRec9[1] = fRec9[0];
			fVec5[1] = fVec5[0];
			fRec3[1] = fRec3[0];
			fRec2[2] = fRec2[1];
			fRec2[1] = fRec2[0];
			fRec16[1] = fRec16[0];
			fRec15[2] = fRec15[1];
			fRec15[1] = fRec15[0];
			fRec18[1] = fRec18[0];
			fRec17[2] = fRec17[1];
			fRec17[1] = fRec17[0];
			fRec25[1] = fRec25[0];
			fRec26[1] = fRec26[0];
			fRec24[1] = fRec24[0];
			fRec23[1] = fRec23[0];
			fRec22[1] = fRec22[0];
			fRec21[1] = fRec21[0];
			fRec20[1] = fRec20[0];
			fRec19[1] = fRec19[0];
			fVec6[1] = fVec6[0];
			fRec1[1] = fRec1[0];
			fRec0[2] = fRec0[1];
			fRec0[1] = fRec0[0];
			fRec29[1] = fRec29[0];
			fRec33[1] = fRec33[0];
			fVec7[1] = fVec7[0];
			fRec32[1] = fRec32[0];
			fVec8[1] = fVec8[0];
			fRec34[1] = fRec34[0];
			fRec31[1] = fRec31[0];
			fRec35[1] = fRec35[0];
			fRec30[1] = fRec30[0];
			fVec9[1] = fVec9[0];
			fRec28[1] = fRec28[0];
			fRec27[2] = fRec27[1];
			fRec27[1] = fRec27[0];
			fRec38[1] = fRec38[0];
			fRec42[1] = fRec42[0];
			fVec10[1] = fVec10[0];
			fRec41[1] = fRec41[0];
			fVec11[1] = fVec11[0];
			fRec43[1] = fRec43[0];
			fRec40[1] = fRec40[0];
			fRec44[1] = fRec44[0];
			fRec39[1] = fRec39[0];
			fVec12[1] = fVec12[0];
			fRec37[1] = fRec37[0];
			fRec36[2] = fRec36[1];
			fRec36[1] = fRec36[0];
			fRec46[1] = fRec46[0];
			fRec45[2] = fRec45[1];
			fRec45[1] = fRec45[0];
		}
	}

};

#endif
