## renders every synth cue and the bed to WAV files in the folder given after --, with how long each took
extends SceneTree
func _init() -> void:
	var dir: String = OS.get_cmdline_user_args()[0]
	for k in Synth.KINDS:
		var t := Time.get_ticks_msec(); var w := Synth.stream(k)
		var peak := 0.0
		for i in range(0, w.data.size(), 2): peak = maxf(peak, absf(w.data.decode_s16(i)/32767.0))
		print("%-8s %4d ms  %.2fs  peak %.2f" % [k, Time.get_ticks_msec() - t, w.data.size()/2.0/Synth.SR, peak])
		w.save_to_wav(dir + "/" + k + ".wav")
	var t2 := Time.get_ticks_msec(); var b := Synth.bed_streams(); print("bed ", Time.get_ticks_msec() - t2, " ms")
	for k in b: b[k].save_to_wav(dir + "/bed_" + k + ".wav")
	quit()
