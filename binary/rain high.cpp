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


class mydsp : public dsp {
	
 private:
	
	FAUSTFLOAT fHslider0;
	int iRec0[2];
	float fVec0[2];
	FAUSTFLOAT fHslider1;
	float fVec1[2];
	int fSampleRate;
	
 public:
	mydsp() {
	}
	
	void metadata(Meta* m) { 
		m->declare("compile_options", "-lang cpp -ct 1 -es 1 -mcd 16 -mdd 1024 -mdy 33 -single -ftz 0");
		m->declare("filename", "untitled.dsp");
		m->declare("name", "untitled");
		m->declare("noises.lib/name", "Faust Noise Generator Library");
		m->declare("noises.lib/version", "1.5.0");
	}

	virtual int getNumInputs() {
		return 0;
	}
	virtual int getNumOutputs() {
		return 2;
	}
	
	static void classInit(int sample_rate) {
	}
	
	virtual void instanceConstants(int sample_rate) {
		fSampleRate = sample_rate;
	}
	
	virtual void instanceResetUserInterface() {
		fHslider0 = static_cast<FAUSTFLOAT>(3e+02f);
		fHslider1 = static_cast<FAUSTFLOAT>(0.5f);
	}
	
	virtual void instanceClear() {
		for (int l0 = 0; l0 < 2; l0 = l0 + 1) {
			iRec0[l0] = 0;
		}
		for (int l1 = 0; l1 < 2; l1 = l1 + 1) {
			fVec0[l1] = 0.0f;
		}
		for (int l2 = 0; l2 < 2; l2 = l2 + 1) {
			fVec1[l2] = 0.0f;
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
		ui_interface->openVerticalBox("rain");
		ui_interface->addHorizontalSlider("density", &fHslider0, FAUSTFLOAT(3e+02f), FAUSTFLOAT(0.0f), FAUSTFLOAT(1e+03f), FAUSTFLOAT(1.0f));
		ui_interface->addHorizontalSlider("volume", &fHslider1, FAUSTFLOAT(0.5f), FAUSTFLOAT(0.0f), FAUSTFLOAT(1.0f), FAUSTFLOAT(0.01f));
		ui_interface->closeBox();
	}
	
	virtual void compute(int count, FAUSTFLOAT** RESTRICT inputs, FAUSTFLOAT** RESTRICT outputs) {
		FAUSTFLOAT* output0 = outputs[0];
		FAUSTFLOAT* output1 = outputs[1];
		float fSlow0 = 0.001f * static_cast<float>(fHslider0);
		float fSlow1 = 4.656613e-10f * static_cast<float>(fHslider1);
		for (int i0 = 0; i0 < count; i0 = i0 + 1) {
			int iTemp0 = 1103515245 * (iRec0[1] + 12345);
			iRec0[0] = 1103515245 * (iTemp0 + 12345);
			int iRec1 = iTemp0;
			float fTemp1 = static_cast<float>(iRec0[0]);
			fVec0[0] = fTemp1;
			output0[i0] = static_cast<FAUSTFLOAT>(fSlow1 * fVec0[1] * static_cast<float>(std::fabs(4.656613e-10f * fTemp1) < fSlow0));
			float fTemp2 = static_cast<float>(iRec1);
			fVec1[0] = fTemp2;
			output1[i0] = static_cast<FAUSTFLOAT>(fSlow1 * fVec1[1] * static_cast<float>(std::fabs(4.656613e-10f * fTemp2) < fSlow0));
			iRec0[1] = iRec0[0];
			fVec0[1] = fVec0[0];
			fVec1[1] = fVec1[0];
		}
	}

};

#endif
