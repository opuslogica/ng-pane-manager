.PHONY: clean

# get documentation.js with:
# npm install -g documentation
docs: ngDocker.js
	documentation build ngDocker.js -f html -o docs

clean: 
	rm -r docs
